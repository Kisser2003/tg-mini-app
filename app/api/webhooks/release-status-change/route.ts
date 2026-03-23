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

type WebhookSecretCheck = "ok" | "missing" | "invalid";

function checkWebhookSecret(request: Request): WebhookSecretCheck {
  const expected = process.env.SUPABASE_WEBHOOK_SECRET?.trim();
  if (!expected) {
    return "missing";
  }

  const provided = request.headers.get("x-supabase-webhook-secret")?.trim() ?? "";

  if (provided.length !== expected.length) {
    return "invalid";
  }

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");

  if (!crypto.timingSafeEqual(a, b)) {
    return "invalid";
  }

  return "ok";
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

function buildReadyPublishedMessage(title: string): string {
  const t = escapeHtml(title.length > 0 ? title : "релиз");
  return `Бро, релиз <b>${t}</b> опубликован! 🚀`;
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

export async function POST(request: Request): Promise<Response> {
  const secretState = checkWebhookSecret(request);

  if (secretState === "missing") {
    console.error(
      "[webhooks/release-status-change] SUPABASE_WEBHOOK_SECRET is not configured"
    );
    return NextResponse.json(
      { ok: false, error: "Webhook not configured" },
      { status: 503 }
    );
  }

  if (secretState === "invalid") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const supa = supabaseWebhookSchema.safeParse(json);
  if (supa.success) {
    const { type, table, record, old_record: oldRecord } = supa.data;

    if (table && table.toLowerCase() !== "releases") {
      return NextResponse.json({ ok: true, skipped: true, reason: "wrong_table" });
    }

    if (type === "DELETE" || record == null) {
      return NextResponse.json({ ok: true, skipped: true, reason: "no_record" });
    }

    const row = record as Record<string, unknown>;
    const status = String(row.status ?? "").trim();

    const chatId = chatIdFromTelegramId(row.telegram_id);
    if (!chatId) {
      console.error("Ошибка: У релиза нет telegram_id, некуда слать уведомление");
      return NextResponse.json({ ok: true, skipped: true, reason: "no_telegram_id" });
    }

    const title = displayTitleFromRecord(row);

    let text: string | null = null;

    if (type === "INSERT" && status === "pending") {
      text = buildPendingMessage(title);
    } else if (type === "UPDATE" && status === "ready") {
      const oldStatus =
        oldRecord && typeof oldRecord === "object" && "status" in oldRecord
          ? String((oldRecord as Record<string, unknown>).status ?? "").trim()
          : "";
      if (oldStatus === "ready") {
        return NextResponse.json({ ok: true, skipped: true, reason: "already_ready" });
      }
      text = buildReadyPublishedMessage(title);
    } else {
      return NextResponse.json({ ok: true, skipped: true, reason: "no_notification_rule" });
    }

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
