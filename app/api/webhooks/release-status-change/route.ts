import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { escapeHtml, sendTelegramBotMessage } from "@/lib/telegram-bot.server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const webhookBodySchema = z.object({
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

function buildReadyMessage(title: string, artistName: string): string {
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

  const parsed = webhookBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id, new_status, error_message: errorMessage } = parsed.data;

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

  const rawTg = release.telegram_id as unknown;
  if (rawTg === null || rawTg === undefined) {
    console.error("Ошибка: У релиза нет telegram_id, некуда слать уведомление");
    return NextResponse.json({ ok: true, skipped: true, reason: "no_telegram_id" });
  }

  const chatId = String(release.telegram_id).trim();
  if (chatId === "" || chatId === "0") {
    console.error("Ошибка: У релиза нет telegram_id, некуда слать уведомление");
    return NextResponse.json({ ok: true, skipped: true, reason: "no_telegram_id" });
  }

  const row = release as {
    title?: string | null;
    artist_name?: string | null;
    track_name?: string | null;
  };
  const displayTitle = String(row.title ?? row.track_name ?? "").trim();
  const displayArtist = String(row.artist_name ?? "").trim();

  const text =
    new_status === "ready"
      ? buildReadyMessage(displayTitle, displayArtist)
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
