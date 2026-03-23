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

function buildReadyMessage(title: string): string {
  const t = escapeHtml(title.trim().length > 0 ? title.trim() : "релиз");
  return (
    `✅ <b>Поздравляем!</b> Ваш релиз «${t}» одобрен и скоро появится на площадках.`
  );
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

  const { id, user_id, new_status, error_message: errorMessage } = parsed.data;

  if (new_status !== "ready" && new_status !== "failed") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let trackName = "";
  const admin = createSupabaseAdmin();
  if (admin) {
    const { data: row } = await admin.from("releases").select("track_name").eq("id", id).maybeSingle();
    const name = row && typeof row === "object" && "track_name" in row ? row.track_name : null;
    if (typeof name === "string") trackName = name;
  }

  const text =
    new_status === "ready"
      ? buildReadyMessage(trackName)
      : buildFailedMessage(trackName, errorMessage ?? null);

  const send = await sendTelegramBotMessage({
    chatId: user_id,
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
