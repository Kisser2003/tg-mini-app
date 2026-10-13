import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STUDIO_ANSWERS,
  STUDIO_CONFIRMER_NAME,
  parsePaymentStatus,
  type PaymentActor,
  type PaymentStatus,
  type StudioAnswer
} from "@/lib/release-payment";
import { getExpectedAdminTelegramId } from "@/lib/admin";
import {
  answerTelegramCallbackQuery,
  editTelegramBotMessage,
  escapeHtml,
  sendTelegramBotMessage,
  type InlineKeyboard
} from "@/lib/telegram-bot.server";
import { getReleaseDisplayTitle, type ReleaseRecord } from "@/repositories/releases/types";
import { notifyArtist } from "@/lib/server/artist-notify";
import { notifyAdminPaymentAnswer } from "@/lib/admin-notify.server";

/**
 * Подтверждение оплаты студией: на каждый отправленный релиз бот пишет Денису
 * «Оплатил? [Оплатил] [Не оплатил] [Не мой клиент]», ответ пишется в releases.payment_*.
 * Кто такой Денис — PAYMENT_CONFIRMER_TELEGRAM_ID; без него бот никому не пишет, статус ставит админ.
 */

export const PAYMENT_RELEASE_SELECT =
  "id, title, track_name, artist_name, telegram_id, telegram_username, user_uuid, payment_status, payment_updated_at, payment_updated_by";

export type PaymentRelease = Pick<ReleaseRecord, "id" | "artist_name"> &
  Pick<
    Partial<ReleaseRecord>,
    | "title"
    | "track_name"
    | "telegram_id"
    | "telegram_username"
    | "user_uuid"
    | "payment_status"
    | "payment_updated_at"
    | "payment_updated_by"
  >;

const ANSWER_BUTTON: Record<StudioAnswer, string> = {
  paid: "✅ Оплатил",
  unpaid: "⏳ Не оплатил",
  not_client: "❓ Не мой клиент"
};

const CALLBACK_RE = /^pay:(paid|unpaid|not_client):([0-9a-f-]{36})$/i;

function digitsOrNull(raw: string | undefined): string | null {
  const v = raw?.trim() ?? "";
  return /^\d+$/.test(v) && v !== "0" ? v : null;
}

export function getStudioConfirmerTelegramId(): string | null {
  return digitsOrNull(process.env.PAYMENT_CONFIRMER_TELEGRAM_ID);
}

/** Ник Дениса без @ — в сообщении артисту «скинь чек @…». */
export function getStudioConfirmerUsername(): string | null {
  const v = process.env.PAYMENT_CONFIRMER_USERNAME?.trim().replace(/^@/, "") ?? "";
  return /^[A-Za-z0-9_]{4,32}$/.test(v) ? v : null;
}

export function paymentCallbackData(answer: StudioAnswer, releaseId: string): string {
  return `pay:${answer}:${releaseId}`;
}

export function parsePaymentCallbackData(data: unknown): { answer: StudioAnswer; releaseId: string } | null {
  if (typeof data !== "string") return null;
  const m = CALLBACK_RE.exec(data);
  if (!m) return null;
  return { answer: m[1] as StudioAnswer, releaseId: m[2].toLowerCase() };
}

function isStudioAnswer(status: PaymentStatus | null): status is StudioAnswer {
  return status != null && (STUDIO_ANSWERS as readonly string[]).includes(status);
}

function formatMoscowTime(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow"
  });
}

function clientLine(release: PaymentRelease): string {
  const username = release.telegram_username?.trim().replace(/^@/, "");
  if (username) return `@${escapeHtml(username)}`;
  if (release.telegram_id != null && String(release.telegram_id).trim() !== "") {
    return `Telegram id ${escapeHtml(String(release.telegram_id))} (без ника)`;
  }
  return "веб-аккаунт, без Telegram";
}

/** Текст сообщения Денису; после ответа — с строкой «Ответ: … · время». */
export function buildStudioPaymentText(release: PaymentRelease, trackCount: number | null): string {
  const titleRaw = getReleaseDisplayTitle(release as ReleaseRecord);
  const title = escapeHtml(titleRaw.length > 0 ? titleRaw : "без названия");
  const artist = escapeHtml(release.artist_name?.trim() || "—");
  const lines = [
    `💳 <b>Оплата релиза</b>`,
    "",
    `«${title}» — ${artist}`,
    `Клиент: ${clientLine(release)}`
  ];
  if (trackCount != null && trackCount > 0) lines.push(`Треков: ${trackCount}`);

  const status = parsePaymentStatus(release.payment_status);
  if (isStudioAnswer(status)) {
    lines.push(
      "",
      `Ответ: <b>${ANSWER_BUTTON[status]}</b> · ${escapeHtml(formatMoscowTime(release.payment_updated_at))}`,
      "Ошибся — нажми нужный вариант ниже."
    );
  } else {
    lines.push("", "Клиент оплатил выпуск?");
  }
  return lines.join("\n");
}

/** До ответа — все три кнопки; после — две оставшиеся, чтобы можно было исправить. */
export function buildStudioPaymentKeyboard(release: PaymentRelease): InlineKeyboard {
  const status = parsePaymentStatus(release.payment_status);
  const button = (answer: StudioAnswer) => ({
    text: ANSWER_BUTTON[answer],
    callback_data: paymentCallbackData(answer, release.id)
  });
  if (isStudioAnswer(status)) {
    return { inline_keyboard: [STUDIO_ANSWERS.filter((a) => a !== status).map(button)] };
  }
  return { inline_keyboard: [[button("paid")], [button("unpaid"), button("not_client")]] };
}

/** Сообщение артисту, когда студия ответила «Не оплатил». */
export function buildPaymentNeededArtistText(release: PaymentRelease): string {
  const titleRaw = getReleaseDisplayTitle(release as ReleaseRecord);
  const title = escapeHtml(titleRaw.length > 0 ? titleRaw : "релиз");
  const username = getStudioConfirmerUsername();
  const receipt = username ? `скинь чек @${username}` : "скинь чек в студию";
  return (
    `💳 <b>Релиз «${title}» получили.</b>\n\n` +
    `Чтобы отправить его на площадки, нужна оплата. Если уже оплатил — ${receipt}.`
  );
}

export async function countReleaseTracks(admin: SupabaseClient, releaseId: string): Promise<number | null> {
  const { count, error } = await admin
    .from("tracks")
    .select("*", { count: "exact", head: true })
    .eq("release_id", releaseId);
  if (error) {
    console.warn("[payment-confirm] tracks count:", error.message);
    return null;
  }
  return count ?? null;
}

async function logPayment(admin: SupabaseClient, releaseId: string, status: PaymentStatus): Promise<void> {
  const { error } = await admin.from("release_logs").insert({
    release_id: releaseId,
    stage: "payment",
    status,
    error_message: null
  });
  if (error) console.warn("[payment-confirm] log:", error.message);
}

export type AskStudioResult = { ok: true } | { ok: false; reason: "not_configured" | "send_failed"; error?: string };

/** Отправить Денису вопрос «Оплатил?» с кнопками. */
export async function askStudioAboutPayment(
  admin: SupabaseClient,
  release: PaymentRelease
): Promise<AskStudioResult> {
  const chatId = getStudioConfirmerTelegramId();
  if (!chatId) return { ok: false, reason: "not_configured" };
  const trackCount = await countReleaseTracks(admin, release.id);
  const sent = await sendTelegramBotMessage({
    chatId,
    text: buildStudioPaymentText(release, trackCount),
    replyMarkup: buildStudioPaymentKeyboard(release)
  });
  if (!sent.ok) {
    console.error("[payment-confirm] send to studio:", sent.error);
    return { ok: false, reason: "send_failed", error: sent.error };
  }
  return { ok: true };
}

/**
 * После отправки на модерацию: если оплату ещё не спрашивали — статус `awaiting` и вопрос Денису.
 * Повторная отправка (после «Вернуть») не спрашивает заново. Ошибки не пробрасываются.
 */
export async function requestPaymentConfirmationOnSubmit(
  admin: SupabaseClient,
  release: PaymentRelease
): Promise<void> {
  try {
    const { data, error } = await admin
      .from("releases")
      .update({ payment_status: "awaiting", payment_updated_at: new Date().toISOString(), payment_updated_by: null })
      .eq("id", release.id)
      .is("payment_status", null)
      .select(PAYMENT_RELEASE_SELECT);
    if (error) {
      console.error("[payment-confirm] mark awaiting:", error.message);
      return;
    }
    const updated = (data as PaymentRelease[] | null)?.[0];
    if (!updated) return;
    await logPayment(admin, release.id, "awaiting");
    await askStudioAboutPayment(admin, updated);
  } catch (e) {
    console.error("[payment-confirm] on submit:", e);
  }
}

export type SetPaymentResult =
  | { ok: true; previous: PaymentStatus | null; release: PaymentRelease }
  | { ok: false; status: 404 | 500; error: string };

/** Записать статус оплаты (+ строка в release_logs, если статус поменялся). */
export async function setReleasePaymentStatus(
  admin: SupabaseClient,
  releaseId: string,
  status: PaymentStatus,
  actor: PaymentActor
): Promise<SetPaymentResult> {
  const { data: row, error: loadErr } = await admin
    .from("releases")
    .select(PAYMENT_RELEASE_SELECT)
    .eq("id", releaseId)
    .maybeSingle();
  if (loadErr) {
    console.error("[payment-confirm] load:", loadErr.message);
    return { ok: false, status: 500, error: "Не удалось загрузить релиз." };
  }
  if (!row) return { ok: false, status: 404, error: "Релиз не найден." };

  const current = row as unknown as PaymentRelease;
  const previous = parsePaymentStatus(current.payment_status);
  if (previous === status) return { ok: true, previous, release: current };

  const { data: upd, error: upErr } = await admin
    .from("releases")
    .update({ payment_status: status, payment_updated_at: new Date().toISOString(), payment_updated_by: actor })
    .eq("id", releaseId)
    .select(PAYMENT_RELEASE_SELECT);
  if (upErr) {
    console.error("[payment-confirm] update:", upErr.message);
    return { ok: false, status: 500, error: "Не удалось сохранить оплату." };
  }
  const updated = (upd as PaymentRelease[] | null)?.[0];
  if (!updated) return { ok: false, status: 404, error: "Релиз не найден." };
  await logPayment(admin, releaseId, status);
  return { ok: true, previous, release: updated };
}

export type TelegramCallbackQuery = {
  id: string;
  from?: { id?: number | string };
  data?: string;
  message?: { message_id?: number; chat?: { id?: number | string } };
};

function callbackActor(fromId: unknown): PaymentActor | null {
  if (fromId == null) return null;
  const studio = getStudioConfirmerTelegramId();
  if (studio && String(fromId) === studio) return "studio";
  try {
    if (String(fromId) === String(getExpectedAdminTelegramId())) return "admin";
  } catch {
    /* админ не настроен */
  }
  return null;
}

/**
 * Нажатие кнопки в сообщении «Оплатил?». Принимаем только от Дениса и админа.
 * «Не оплатил» от студии → бот пишет артисту, что нужна оплата.
 */
export async function handlePaymentCallback(admin: SupabaseClient, query: TelegramCallbackQuery): Promise<void> {
  const parsed = parsePaymentCallbackData(query.data);
  if (!parsed) {
    await answerTelegramCallbackQuery(query.id);
    return;
  }
  const actor = callbackActor(query.from?.id);
  if (!actor) {
    await answerTelegramCallbackQuery(query.id, "Эта кнопка не для тебя.");
    return;
  }

  const result = await setReleasePaymentStatus(admin, parsed.releaseId, parsed.answer, actor);
  if (!result.ok) {
    await answerTelegramCallbackQuery(
      query.id,
      result.status === 404 ? "Релиз не найден — возможно, его удалили." : "Не получилось сохранить, нажми ещё раз."
    );
    return;
  }

  const changed = result.previous !== parsed.answer;
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  if (chatId != null && typeof messageId === "number") {
    const trackCount = await countReleaseTracks(admin, parsed.releaseId);
    const edited = await editTelegramBotMessage({
      chatId,
      messageId,
      text: buildStudioPaymentText(result.release, trackCount),
      replyMarkup: buildStudioPaymentKeyboard(result.release)
    });
    if (!edited.ok && !/not modified/i.test(edited.error)) {
      console.warn("[payment-confirm] edit:", edited.error);
    }
  }

  if (changed && actor === "studio") {
    if (parsed.answer === "unpaid") {
      await notifyArtist(result.release, buildPaymentNeededArtistText(result.release));
    }
    await notifyAdminPaymentAnswer({
      title: getReleaseDisplayTitle(result.release as ReleaseRecord),
      artist: result.release.artist_name ?? "",
      answer: ANSWER_BUTTON[parsed.answer],
      who: STUDIO_CONFIRMER_NAME
    });
  }

  await answerTelegramCallbackQuery(query.id, changed ? `Записал: ${ANSWER_BUTTON[parsed.answer]}` : "Уже отмечено.");
}
