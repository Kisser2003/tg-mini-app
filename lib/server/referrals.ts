import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REFEREE_DISCOUNT_RUB,
  REFERRER_REWARD_RUB,
  formatRub,
  referralStartParam,
  type ReferralSummary
} from "@/lib/referral";
import type { PaymentStatus } from "@/lib/release-payment";
import { artistTelegramId, notifyArtist } from "@/lib/server/artist-notify";
import { getExpectedAdminTelegramId } from "@/lib/admin";
import { notifyAdminReferralPayout } from "@/lib/admin-notify.server";
import { answerTelegramCallbackQuery, editTelegramBotMessage, escapeHtml } from "@/lib/telegram-bot.server";

/**
 * Реферальная программа. Друг открывает мини-приложение по ссылке `…?startapp=ref_<code>`,
 * его telegram_id привязывается к пригласившему (только если у него ещё нет релизов).
 * Скидку другу видят Денис (сообщение «Оплатил?») и админ (страница релиза): клиент платит на 500 ₽ меньше.
 * Когда студия отметит первый релиз друга оплаченным, админу приходит «Выплати 500 ₽ …» с кнопкой «Выплатил»:
 * деньги пригласившему админ переводит вручную, приложение только напоминает и помнит, кому уже заплатили.
 */

type ReleaseRef = { id: string; telegram_id?: unknown; payment_status?: string | null };

/**
 * Состояние — по `paid_at` / `reward_redeemed_at`: id релизов обнуляются при удалении релиза
 * (ON DELETE SET NULL), и тогда скидка или бонус «воскресли» бы второй раз.
 */
type ReferralRow = {
  referee_telegram_id: string;
  referrer_telegram_id: string;
  paid_release_id: string | null;
  paid_at: string | null;
  reward_redeemed_release_id: string | null;
  reward_redeemed_at: string | null;
};

/** Без 0/O/1/I — код читают глазами. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const UNIQUE_VIOLATION = "23505";

function randomCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

/** Ссылка на мини-приложение с кодом; TELEGRAM_MINI_APP_URL — например https://t.me/omf_bot/app. */
export function referralLink(code: string): string | null {
  const base = process.env.TELEGRAM_MINI_APP_URL?.trim().replace(/\/+$/, "") ?? "";
  if (!/^https:\/\/t\.me\/[A-Za-z0-9_]{4,64}(\/[A-Za-z0-9_]{1,64})?$/.test(base)) return null;
  return `${base}?startapp=${referralStartParam(code)}`;
}

export async function getOrCreateReferralCode(admin: SupabaseClient, telegramId: string): Promise<string | null> {
  const load = async () => {
    const { data, error } = await admin
      .from("referral_codes")
      .select("code")
      .eq("telegram_id", telegramId)
      .maybeSingle();
    if (error) console.error("[referrals] load code:", error.message);
    return (data as { code?: string } | null)?.code ?? null;
  };

  const existing = await load();
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { error } = await admin.from("referral_codes").insert({ telegram_id: telegramId, code });
    if (!error) return code;
    if (error.code !== UNIQUE_VIOLATION) {
      console.error("[referrals] create code:", error.message);
      return null;
    }
    // Конфликт: либо код занят (пробуем другой), либо параллельный запрос уже создал код этому пользователю.
    const raced = await load();
    if (raced) return raced;
  }
  return null;
}

export type AttributeResult = "attributed" | "already" | "not_new" | "self" | "unknown_code" | "error";

/** Привязать друга к пригласившему. Только новые пользователи: ни одного релиза, даже черновика. */
export async function attributeReferral(
  admin: SupabaseClient,
  refereeTelegramId: string,
  code: string
): Promise<AttributeResult> {
  const { data: owner, error: ownerErr } = await admin
    .from("referral_codes")
    .select("telegram_id")
    .eq("code", code)
    .maybeSingle();
  if (ownerErr) {
    console.error("[referrals] code lookup:", ownerErr.message);
    return "error";
  }
  const referrer = (owner as { telegram_id?: string } | null)?.telegram_id;
  if (!referrer) return "unknown_code";
  if (referrer === refereeTelegramId) return "self";

  const { data: existing, error: existingErr } = await admin
    .from("referrals")
    .select("referee_telegram_id")
    .eq("referee_telegram_id", refereeTelegramId)
    .maybeSingle();
  if (existingErr) {
    console.error("[referrals] existing lookup:", existingErr.message);
    return "error";
  }
  if (existing) return "already";

  // Релизы с сайта до привязки Telegram лежат под user_uuid без telegram_id — их тоже считаем.
  const { data: profile, error: profileErr } = await admin
    .from("users")
    .select("id")
    .eq("telegram_id", refereeTelegramId)
    .maybeSingle();
  if (profileErr) {
    console.error("[referrals] profile lookup:", profileErr.message);
    return "error";
  }
  const uuid = (profile as { id?: string } | null)?.id;
  const ownerFilter =
    uuid && /^[0-9a-f-]{36}$/i.test(uuid)
      ? `telegram_id.eq.${refereeTelegramId},user_id.eq.${refereeTelegramId},user_uuid.eq.${uuid}`
      : `telegram_id.eq.${refereeTelegramId},user_id.eq.${refereeTelegramId}`;
  const { count, error: countErr } = await admin
    .from("releases")
    .select("id", { count: "exact", head: true })
    .or(ownerFilter);
  if (countErr) {
    console.error("[referrals] releases count:", countErr.message);
    return "error";
  }
  if ((count ?? 0) > 0) return "not_new";

  const { error: insertErr } = await admin
    .from("referrals")
    .insert({ referee_telegram_id: refereeTelegramId, referrer_telegram_id: referrer });
  if (insertErr) {
    if (insertErr.code === UNIQUE_VIOLATION) return "already";
    console.error("[referrals] attribute:", insertErr.message);
    return "error";
  }
  return "attributed";
}

export async function getReferralSummary(
  admin: SupabaseClient,
  telegramId: string
): Promise<ReferralSummary | null> {
  const code = await getOrCreateReferralCode(admin, telegramId);
  if (!code) return null;

  const [invitedRes, ownRes] = await Promise.all([
    admin
      .from("referrals")
      .select("paid_at, reward_redeemed_at")
      .eq("referrer_telegram_id", telegramId),
    admin.from("referrals").select("paid_at").eq("referee_telegram_id", telegramId).maybeSingle()
  ]);
  if (invitedRes.error) console.error("[referrals] summary:", invitedRes.error.message);
  const invited = (invitedRes.data ?? []) as Pick<ReferralRow, "paid_at" | "reward_redeemed_at">[];
  const own = ownRes.data as Pick<ReferralRow, "paid_at"> | null;

  return {
    code,
    link: referralLink(code),
    invited: invited.length,
    paid: invited.filter((r) => r.paid_at).length,
    available: invited.filter((r) => r.paid_at && !r.reward_redeemed_at).length,
    hasPendingDiscount: Boolean(own && !own.paid_at)
  };
}

/** «@ник» или «tg id N» — по последнему релизу этого пользователя. */
export async function telegramLabel(admin: SupabaseClient, tid: string): Promise<string> {
  const { data } = await admin
    .from("releases")
    .select("telegram_username")
    .eq("telegram_id", tid)
    .not("telegram_username", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const username = (data as { telegram_username?: string | null }[] | null)?.[0]?.telegram_username
    ?.trim()
    .replace(/^@/, "");
  return username ? `@${username}` : `tg id ${tid}`;
}

/** Реферальные сведения по релизу для админки (релиз друга, пришедшего по приглашению). */
export type ReleaseReferral = {
  referrerLabel: string;
  /** Скидка клиенту на этот релиз; null — уже не первый релиз, скидки нет. */
  discountRub: number | null;
  /** Выплата пригласившему: появляется, когда этот релиз отмечен «Оплачено». */
  payout: { amountRub: number; status: "due" | "done" } | null;
};

export async function getReleaseReferral(admin: SupabaseClient, release: ReleaseRef): Promise<ReleaseReferral | null> {
  const tid = artistTelegramId(release);
  if (!tid) return null;
  const { data, error } = await admin
    .from("referrals")
    .select("referrer_telegram_id, paid_release_id, paid_at, reward_redeemed_at")
    .eq("referee_telegram_id", tid)
    .maybeSingle();
  if (error) {
    console.error("[referrals] release referral:", error.message);
    return null;
  }
  const row = data as Pick<
    ReferralRow,
    "referrer_telegram_id" | "paid_release_id" | "paid_at" | "reward_redeemed_at"
  > | null;
  if (!row) return null;
  const isPaidOne = row.paid_at != null && row.paid_release_id === release.id;
  return {
    referrerLabel: await telegramLabel(admin, row.referrer_telegram_id),
    discountRub: row.paid_at == null || isPaidOne ? REFEREE_DISCOUNT_RUB : null,
    payout: isPaidOne
      ? { amountRub: REFERRER_REWARD_RUB, status: row.reward_redeemed_at ? "done" : "due" }
      : null
  };
}

/**
 * Строки для сообщения Денису «Оплатил?»: скидка другу, пришедшему по приглашению.
 * Бонус пригласившему сюда не попадает — его выплачивает админ отдельно. Ошибки → пустой список.
 */
export async function referralPaymentLines(admin: SupabaseClient, release: ReleaseRef): Promise<string[]> {
  try {
    const info = await getReleaseReferral(admin, release);
    if (info?.discountRub == null) return [];
    return [
      `🎁 Пришёл по приглашению от ${escapeHtml(info.referrerLabel)}: скидка ${formatRub(info.discountRub)} на первый релиз`,
      `К оплате на ${formatRub(info.discountRub)} меньше`
    ];
  } catch (e) {
    console.error("[referrals] payment lines:", e);
    return [];
  }
}

export type PayoutResult =
  | { ok: true; referrerLabel: string; refereeLabel: string; amountRub: number }
  | { ok: false; status: 404 | 409 | 500; error: string };

/** Отметить, что админ выплатил (или вернуть в «к выплате») бонус за приглашённого друга. */
export async function setReferralPayout(
  admin: SupabaseClient,
  refereeTelegramId: string,
  done: boolean
): Promise<PayoutResult> {
  const { data, error } = await admin
    .from("referrals")
    .update({ reward_redeemed_at: done ? new Date().toISOString() : null })
    .eq("referee_telegram_id", refereeTelegramId)
    .not("paid_at", "is", null)
    .select("referrer_telegram_id");
  if (error) {
    console.error("[referrals] payout:", error.message);
    return { ok: false, status: 500, error: "Не удалось сохранить выплату." };
  }
  const row = (data as Pick<ReferralRow, "referrer_telegram_id">[] | null)?.[0];
  if (!row) return { ok: false, status: 404, error: "Выплата не найдена: друг ещё не оплатил первый релиз." };
  const [referrerLabel, refereeLabel] = await Promise.all([
    telegramLabel(admin, row.referrer_telegram_id),
    telegramLabel(admin, refereeTelegramId)
  ]);
  return { ok: true, referrerLabel, refereeLabel, amountRub: REFERRER_REWARD_RUB };
}

/**
 * После смены статуса оплаты релиза.
 * → paid: первый оплаченный релиз друга открывает выплату пригласившему: сообщение админу с кнопкой
 *         «Выплатил» и уведомление пригласившему.
 * paid → другое: закрываем выплату, если её ещё не выплатили. Ошибки не пробрасываются.
 */
export async function applyReferralPaymentChange(
  admin: SupabaseClient,
  release: ReleaseRef,
  previous: PaymentStatus | null,
  next: PaymentStatus
): Promise<void> {
  const tid = artistTelegramId(release);
  if (!tid) return;
  try {
    if (next === "paid") {
      const { data: opened, error: openErr } = await admin
        .from("referrals")
        .update({ paid_release_id: release.id, paid_at: new Date().toISOString() })
        .eq("referee_telegram_id", tid)
        .is("paid_at", null)
        .select("referrer_telegram_id");
      if (openErr) console.error("[referrals] open reward:", openErr.message);
      const referrer = (opened as Pick<ReferralRow, "referrer_telegram_id">[] | null)?.[0]?.referrer_telegram_id;
      if (!referrer) return;
      await notifyArtist(
        { telegram_id: referrer },
        `🎁 <b>Друг оплатил первый релиз</b>\n\nТебе ${formatRub(REFERRER_REWARD_RUB)} — переведём в ближайшее время, ` +
          `если понадобятся реквизиты, напишем.`
      );
      const [referrerLabel, refereeLabel] = await Promise.all([
        telegramLabel(admin, referrer),
        telegramLabel(admin, tid)
      ]);
      await notifyAdminReferralPayout({ refereeTelegramId: tid, referrerLabel, refereeLabel, amountRub: REFERRER_REWARD_RUB });
      return;
    }

    if (previous === "paid") {
      const { error } = await admin
        .from("referrals")
        .update({ paid_release_id: null, paid_at: null })
        .eq("paid_release_id", release.id)
        .is("reward_redeemed_at", null);
      if (error) console.error("[referrals] close reward:", error.message);
    }
  } catch (e) {
    console.error("[referrals] payment change:", e);
  }
}

const PAYOUT_CALLBACK_RE = /^ref:out:(\d{1,20})$/;

export function referralPayoutCallbackData(refereeTelegramId: string): string {
  return `ref:out:${refereeTelegramId}`;
}

/** Нажатие «Выплатил» в сообщении админу. Принимаем только от админа. */
export async function handleReferralCallback(
  admin: SupabaseClient,
  query: { id: string; from?: { id?: number | string }; data?: string; message?: { message_id?: number; chat?: { id?: number | string } } }
): Promise<void> {
  const m = PAYOUT_CALLBACK_RE.exec(query.data ?? "");
  if (!m) {
    await answerTelegramCallbackQuery(query.id);
    return;
  }
  let isAdmin = false;
  try {
    isAdmin = query.from?.id != null && String(query.from.id) === String(getExpectedAdminTelegramId());
  } catch {
    /* админ не настроен */
  }
  if (!isAdmin) {
    await answerTelegramCallbackQuery(query.id, "Эта кнопка не для тебя.");
    return;
  }
  const result = await setReferralPayout(admin, m[1], true);
  if (!result.ok) {
    await answerTelegramCallbackQuery(query.id, result.error);
    return;
  }
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  if (chatId != null && typeof messageId === "number") {
    await editTelegramBotMessage({
      chatId,
      messageId,
      text:
        `✅ <b>Выплачено ${formatRub(result.amountRub)}</b>\n\n` +
        `${escapeHtml(result.referrerLabel)} — за приглашённого ${escapeHtml(result.refereeLabel)}`
    });
  }
  await answerTelegramCallbackQuery(query.id, "Записал: выплачено");
}
