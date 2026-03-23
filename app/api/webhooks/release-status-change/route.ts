import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { escapeHtml, sendTelegramBotMessage } from "@/lib/telegram-bot.server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/** Supabase Database Webhooks (INSERT / UPDATE на `releases`). */
const supabaseWebhookSchema = z.object({
  type: z.enum(["INSERT", "UPDATE", "DELETE"]),
  table: z.string().optional(),
  schema: z.string().optional(),
  record: z.record(z.string(), z.unknown()).nullable().optional(),
  old_record: z.record(z.string(), z.unknown()).nullable().optional()
});

/** Старый формат из `pg_net` / триггера с кастомным JSON (обратная совместимость). */
const legacyWebhookBodySchema = z.object({
  id: z.string().uuid(),
  user_id: z.coerce.number().int(),
  old_status: z.string().nullable(),
  new_status: z.string(),
  error_message: z.string().nullable().optional()
});

type WebhookAuthResult =
  | { ok: true }
  | { ok: false; reason: "missing_env" | "missing_header" | "mismatch" };

function timingSafeEqualUtf8(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length || aHex.length % 2 !== 0) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(aHex, "hex"), Buffer.from(bHex, "hex"));
  } catch {
    return false;
  }
}

/**
 * Плоский секрет из заголовков (как в Supabase → Database Webhooks → HTTP Headers).
 * Порядок: `x-supabase-signature` (часто так называют кастомный секрет), затем остальные.
 */
function collectPlainSecretsFromHeaders(request: Request): string[] {
  const names = [
    "x-supabase-signature",
    "x-supabase-webhook-secret",
    "x-webhook-secret"
  ];
  const out: string[] = [];
  for (const n of names) {
    const v = request.headers.get(n)?.trim();
    if (v) out.push(v);
  }
  const auth = request.headers.get("authorization")?.trim() ?? "";
  if (auth.length >= 7 && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) out.push(token);
  }
  return out;
}

/**
 * Проверка HMAC-SHA256(rawBody), если в `x-supabase-signature` приходит дайджест, а не плоский секрет.
 */
function verifyHmacSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader?.trim()) return false;
  let sig = signatureHeader.trim();
  if (sig.toLowerCase().startsWith("sha256=")) {
    sig = sig.slice(7).trim();
  }
  const hmacHex = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  if (sig.length === 64 && /^[0-9a-fA-F]+$/.test(sig)) {
    return timingSafeEqualHex(hmacHex.toLowerCase(), sig.toLowerCase());
  }
  const hmacB64 = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  return timingSafeEqualUtf8(hmacB64, sig);
}

function checkWebhookAuth(request: Request, rawBody: string): WebhookAuthResult {
  /**
   * По умолчанию проверка **выключена**, чтобы вебхук из Supabase не получал 401, пока заголовки не совпали.
   * Для продакшена: задай в Vercel `WEBHOOK_REQUIRE_SECRET=true` и те же секреты в HTTP Headers Supabase
   * (`x-supabase-signature` или `x-supabase-webhook-secret` = `SUPABASE_WEBHOOK_SECRET`).
   */
  if (process.env.WEBHOOK_REQUIRE_SECRET !== "true") {
    console.warn(
      "[webhooks/release-status-change] проверка секрета пропущена (WEBHOOK_REQUIRE_SECRET не true). Поставь WEBHOOK_REQUIRE_SECRET=true после настройки заголовков."
    );
    return { ok: true };
  }

  if (process.env.SKIP_WEBHOOK_SECRET_VERIFY === "true") {
    console.warn(
      "[webhooks/release-status-change] SKIP_WEBHOOK_SECRET_VERIFY=true — проверка отключена"
    );
    return { ok: true };
  }

  if (process.env.WEBHOOK_DISABLE_SECRET_CHECK === "true") {
    console.warn(
      "[webhooks/release-status-change] WEBHOOK_DISABLE_SECRET_CHECK=true — проверка отключена (временно)"
    );
    return { ok: true };
  }

  const expected = process.env.SUPABASE_WEBHOOK_SECRET?.trim();
  if (!expected) {
    return { ok: false, reason: "missing_env" };
  }

  const plainCandidates = collectPlainSecretsFromHeaders(request);
  for (const p of plainCandidates) {
    if (timingSafeEqualUtf8(p, expected)) {
      return { ok: true };
    }
  }

  const sigForHmac = request.headers.get("x-supabase-signature")?.trim();
  if (sigForHmac && verifyHmacSignature(rawBody, sigForHmac, expected)) {
    return { ok: true };
  }

  if (plainCandidates.length === 0 && !sigForHmac) {
    return { ok: false, reason: "missing_header" };
  }

  return { ok: false, reason: "mismatch" };
}

function displayTitleFromRecord(record: Record<string, unknown>): string {
  const raw = record.title ?? record.track_name;
  if (typeof raw === "string") return raw.trim();
  if (raw == null) return "";
  return String(raw).trim();
}

function buildPendingMessage(title: string): string {
  const t = escapeHtml(title.length > 0 ? title : "релиз");
  return `Бро, релиз <b>${t}</b> получен! Скоро проверим. ⚡️`;
}

function buildLegacyReadyMessage(title: string, artistName: string): string {
  const t = escapeHtml(title.trim().length > 0 ? title.trim() : "релиз");
  const a = escapeHtml(artistName.trim().length > 0 ? artistName.trim() : "Артист");
  return `Бро, твой релиз <b>${t}</b> от артиста <b>${a}</b> успешно прошел модерацию и отправлен на площадки! 🚀`;
}

function buildFailedMessage(title: string, errorMessage: string | null | undefined): string {
  const t = escapeHtml(title.trim().length > 0 ? title.trim() : "релиз");
  let body =
    `⚠️ <b>Нужны правки.</b> В вашем релизе «${t}» найдены ошибки. Пожалуйста, проверьте комментарии в приложении.`;

  if (errorMessage && errorMessage.trim().length > 0) {
    body += `\n\n<i>Комментарий модератора:</i>\n${escapeHtml(errorMessage.trim())}`;
  }

  return body;
}

function chatIdFromTelegramId(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === "" || s === "0") return null;
  return s;
}

/** Статус из Supabase record (без падений при отсутствии поля). */
function statusFromRow(row: Record<string, unknown> | null | undefined): string {
  if (!row || typeof row !== "object") return "";
  const s = row.status;
  if (s === null || s === undefined) return "";
  return String(s).trim();
}

/** Иногда тело приходит как `{ payload: { type, record, ... } }`. */
function unwrapSupabaseWebhookJson(json: unknown): unknown {
  if (!json || typeof json !== "object") return json;
  const o = json as Record<string, unknown>;
  const p = o.payload;
  if (p != null && typeof p === "object" && "type" in p) {
    return p;
  }
  return json;
}

function isNonEmptyField(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
}

/**
 * В строке `releases`: есть `audio_url` и/или `artwork_url` (не null и не "").
 * `tracks.file_path` в этот объект не входит — см. `assertReleaseAudioReady`.
 */
function hasReleaseFileLinks(record: Record<string, unknown>): boolean {
  return isNonEmptyField(record.audio_url) || isNonEmptyField(record.artwork_url);
}

function releaseContentReadySync(record: Record<string, unknown>): boolean {
  return hasReleaseFileLinks(record);
}

/**
 * Есть ли загруженное аудио: либо строки в `tracks`, либо `audio_url`/`artwork_url` на релизе.
 */
async function assertReleaseAudioReady(
  admin: NonNullable<ReturnType<typeof createSupabaseAdmin>>,
  releaseId: string,
  record: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: trackRows, error } = await admin
    .from("tracks")
    .select("file_path")
    .eq("release_id", releaseId);

  if (error) {
    return { ok: false, reason: `tracks_query_failed:${error.message}` };
  }

  const rows = trackRows ?? [];
  if (rows.length > 0) {
    const emptyPaths = rows.filter((t) => !isNonEmptyField(t?.file_path));
    if (emptyPaths.length > 0) {
      return { ok: false, reason: "missing_tracks_file_path" };
    }
    return { ok: true };
  }

  if (!hasReleaseFileLinks(record)) {
    return { ok: false, reason: "missing_audio_url_and_artwork_url_and_no_tracks" };
  }
  return { ok: true };
}

export async function POST(request: Request): Promise<Response> {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const auth = checkWebhookAuth(request, rawBody);

  if (!auth.ok && auth.reason === "missing_env") {
    console.error(
      "[webhooks/release-status-change] SUPABASE_WEBHOOK_SECRET is not configured"
    );
    return NextResponse.json(
      { ok: false, error: "Webhook not configured" },
      { status: 503 }
    );
  }

  if (!auth.ok) {
    const hintMissing =
      "В Supabase → Database Webhooks → HTTP Headers: имя **`x-supabase-signature`** или **`x-supabase-webhook-secret`**, " +
      "значение — **то же**, что **`SUPABASE_WEBHOOK_SECRET`** в Vercel. Либо **`Authorization: Bearer <секрет>`**. " +
      "Временно без проверки: **`WEBHOOK_DISABLE_SECRET_CHECK=true`** в Vercel.";
    const hintMismatch =
      "Секрет/HMAC не совпадает с `SUPABASE_WEBHOOK_SECRET` в Vercel. Проверь значение заголовка или отключи проверку временно.";

    console.error(
      "[webhooks/release-status-change] 401:",
      auth.reason === "missing_header" ? "нет подходящих заголовков" : "секрет/HMAC не совпал"
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
        hint: auth.reason === "missing_header" ? hintMissing : hintMismatch
      },
      { status: 401 }
    );
  }

  let json: unknown;
  try {
    json = rawBody.length === 0 ? null : JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const unwrapped = unwrapSupabaseWebhookJson(json);
  const supa = supabaseWebhookSchema.safeParse(unwrapped);
  if (supa.success) {
    const { type, table, record, old_record: oldRecord } = supa.data;

    const newStatus = record != null && typeof record === "object" ? statusFromRow(record) : "";
    const oldStatus =
      oldRecord != null && typeof oldRecord === "object"
        ? statusFromRow(oldRecord as Record<string, unknown>)
        : "";

    console.log("[webhooks/release-status-change] supabase event", {
      eventType: type,
      table: table ?? "(unset)",
      newStatus: newStatus || "(empty)",
      oldStatus: oldRecord == null ? "(no old_record)" : oldStatus || "(empty)"
    });

    if (table && table.toLowerCase() !== "releases") {
      console.log("[webhooks/release-status-change] skip: wrong_table", { table });
      return NextResponse.json({ ok: true, skipped: true, reason: "wrong_table" });
    }

    if (type === "DELETE") {
      console.log("[webhooks/release-status-change] skip: DELETE");
      return NextResponse.json({ ok: true, skipped: true, reason: "delete" });
    }

    if (record == null || typeof record !== "object") {
      console.log("[webhooks/release-status-change] skip: no record");
      return NextResponse.json({ ok: true, skipped: true, reason: "no_record" });
    }

    const row = record as Record<string, unknown>;

    console.log(
      "REAL_FIELDS_IN_RECORD:",
      Object.keys(row),
      "VALUES:",
      {
        audio: row.audio_url,
        art: row.artwork_url,
        track: row.track_url
      }
    );
    console.log(
      "[webhooks/release-status-change] note: WAV/треки в таблице `tracks` (file_path) не приходят в record вебхука по `releases` — только колонки этой строки"
    );

    console.log("Content check:", {
      hasAudioUrl: isNonEmptyField(row.audio_url),
      hasArtworkUrl: isNonEmptyField(row.artwork_url),
      hasReleaseFileLinks: hasReleaseFileLinks(row),
      type
    });

    if (type === "INSERT") {
      if (newStatus !== "pending") {
        console.log("[webhooks/release-status-change] ignore INSERT (not pending yet)", {
          newStatus: newStatus || "(empty)"
        });
        return NextResponse.json({ message: "Ignore initial draft" }, { status: 200 });
      }
      if (!releaseContentReadySync(row)) {
        console.log(
          "[webhooks/release-status-change] ignore INSERT (pending but audio_url/artwork_url empty)",
          {
            audio_url: row.audio_url,
            artwork_url: row.artwork_url
          }
        );
        return NextResponse.json({ message: "Ignore initial draft" }, { status: 200 });
      }
    } else if (type === "UPDATE") {
      if (newStatus !== "pending") {
        console.log("[webhooks/release-status-change] skip UPDATE (new status is not pending)", {
          newStatus: newStatus || "(empty)"
        });
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "update_new_not_pending"
        });
      }
      if (oldRecord == null || typeof oldRecord !== "object") {
        console.log("[webhooks/release-status-change] skip UPDATE (missing old_record, cannot verify transition)");
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "missing_old_record"
        });
      }

      const oldRow = oldRecord as Record<string, unknown>;
      const transitionToPending = oldStatus !== "pending" && newStatus === "pending";
      const gainedFilesWhilePending =
        oldStatus === "pending" &&
        newStatus === "pending" &&
        !hasReleaseFileLinks(oldRow) &&
        hasReleaseFileLinks(row);

      if (!transitionToPending && !gainedFilesWhilePending) {
        console.log("[webhooks/release-status-change] skip UPDATE (no notify rule)", {
          oldStatus,
          newStatus,
          transitionToPending,
          gainedFilesWhilePending
        });
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "update_no_notify_rule"
        });
      }
    } else {
      console.log("[webhooks/release-status-change] skip: event type not handled", { eventType: type });
      return NextResponse.json({ ok: true, skipped: true, reason: "unhandled_event_type" });
    }

    const contentReadySync = releaseContentReadySync(row);
    console.log("releaseContentReadySync:", contentReadySync, {
      audio_url: row.audio_url,
      artwork_url: row.artwork_url
    });

    if (!contentReadySync) {
      console.log("Skip Telegram: release is not fully filled yet", {
        reason: "release_content_sync_failed",
        audio_url: row.audio_url,
        artwork_url: row.artwork_url
      });
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "release_not_ready"
      });
    }

    const releaseIdRaw = row.id;
    const releaseId =
      typeof releaseIdRaw === "string" && releaseIdRaw.length > 0 ? releaseIdRaw : null;
    if (!releaseId) {
      console.log("Skip Telegram: release is not fully filled yet", {
        reason: "no_release_id_in_record"
      });
      return NextResponse.json({ ok: true, skipped: true, reason: "no_release_id" });
    }

    const adminForAudio = createSupabaseAdmin();
    if (adminForAudio) {
      const audioReady = await assertReleaseAudioReady(adminForAudio, releaseId, row);
      if (!audioReady.ok) {
        console.log("Skip Telegram: release is not fully filled yet", {
          reason: audioReady.reason
        });
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "release_not_ready_audio",
          detail: audioReady.reason
        });
      }
    } else {
      if (!hasReleaseFileLinks(row)) {
        console.log("Skip Telegram: release is not fully filled yet", {
          reason: "missing_audio_artwork_no_service_role_for_tracks",
          hint: "SUPABASE_SERVICE_ROLE_KEY needed to verify tracks.file_path"
        });
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "release_not_ready_audio_fallback"
        });
      }
    }

    const chatId = chatIdFromTelegramId(row.telegram_id);
    if (!chatId) {
      console.error("Ошибка: У релиза нет telegram_id, некуда слать уведомление");
      return NextResponse.json({ ok: true, skipped: true, reason: "no_telegram_id" });
    }

    const title = displayTitleFromRecord(row);
    const text = buildPendingMessage(title);

    console.log("[webhooks/release-status-change] sending Telegram (pending)", {
      eventType: type,
      newStatus,
      oldStatus: oldRecord != null ? oldStatus : "(n/a)"
    });

    const send = await sendTelegramBotMessage({
      chatId,
      text,
      parseMode: "HTML"
    });

    if (!send.ok) {
      console.error("[webhooks/release-status-change] Telegram send failed:", send.error);
      return NextResponse.json(
        { ok: false, error: "Telegram send failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  const legacy = legacyWebhookBodySchema.safeParse(json);
  if (!legacy.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: legacy.error.flatten() },
      { status: 400 }
    );
  }

  const { id, new_status, error_message: errorMessage } = legacy.data;

  if (new_status !== "ready" && new_status !== "failed") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    console.error("[webhooks/release-status-change] Supabase admin client not configured");
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 503 });
  }

  const { data: release, error: relErr } = await admin
    .from("releases")
    .select("telegram_id, title, artist_name, track_name")
    .eq("id", id)
    .maybeSingle();

  if (relErr) {
    console.error("[webhooks/release-status-change] releases select:", relErr.message);
    return NextResponse.json({ ok: false, error: "Failed to load release" }, { status: 500 });
  }

  if (!release) {
    console.error("[webhooks/release-status-change] release not found:", id);
    return NextResponse.json({ ok: false, error: "Release not found" }, { status: 404 });
  }

  const chatId = chatIdFromTelegramId(release.telegram_id);
  if (!chatId) {
    console.error("Ошибка: У релиза нет telegram_id, некуда слать уведомление");
    return NextResponse.json({ ok: true, skipped: true, reason: "no_telegram_id" });
  }

  const rel = release as {
    title?: string | null;
    artist_name?: string | null;
    track_name?: string | null;
  };
  const displayTitle = String(rel.title ?? rel.track_name ?? "").trim();
  const displayArtist = String(rel.artist_name ?? "").trim();

  const text =
    new_status === "ready"
      ? buildLegacyReadyMessage(displayTitle, displayArtist)
      : buildFailedMessage(displayTitle, errorMessage ?? null);

  const send = await sendTelegramBotMessage({
    chatId,
    text,
    parseMode: "HTML"
  });

  if (!send.ok) {
    console.error("[webhooks/release-status-change] Telegram send failed:", send.error);
    return NextResponse.json(
      { ok: false, error: "Telegram send failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
