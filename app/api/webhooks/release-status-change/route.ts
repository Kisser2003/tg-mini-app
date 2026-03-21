import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { escapeHtml, sendTelegramBotMessage } from "@/lib/telegram-bot.server";

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

function buildReadyMessage(releaseId: string): string {
  const idShort = escapeHtml(releaseId.slice(0, 8));
  return (
    `<b>Релиз одобрен</b>\n\n` +
    `Поздравляем! Твой релиз прошёл проверку и скоро появится на площадках.\n\n` +
    `<code>id: ${idShort}…</code>`
  );
}

function buildFailedMessage(releaseId: string, errorMessage: string | null | undefined): string {
  const idShort = escapeHtml(releaseId.slice(0, 8));
  let body =
    `<b>Релиз отклонён</b>\n\n` +
    `К сожалению, релиз не прошёл модерацию. Проверь данные в приложении и при необходимости загрузи заново.\n\n` +
    `<code>id: ${idShort}…</code>`;

  if (errorMessage && errorMessage.trim().length > 0) {
    body += `\n\n<i>Подробности:</i>\n${escapeHtml(errorMessage.trim())}`;
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

  const text =
    new_status === "ready"
      ? buildReadyMessage(id)
      : buildFailedMessage(id, errorMessage ?? null);

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
