/**
 * Входящие обновления бота (setWebhook, см. scripts/telegram-webhook.mjs).
 * Обрабатываем нажатия кнопок «Оплатил / Не оплатил / Не мой клиент» и «Выплатил» (бонус за приглашение).
 * Telegram ставит заголовок X-Telegram-Bot-Api-Secret-Token = secret_token из setWebhook.
 */
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { handlePaymentCallback, type TelegramCallbackQuery } from "@/lib/server/payment-confirm";
import { handleReferralCallback } from "@/lib/server/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET_HEADER = "x-telegram-bot-api-secret-token";

function secretMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
  if (!expected) {
    console.error("[telegram/webhook] TELEGRAM_WEBHOOK_SECRET is not set");
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  if (!secretMatches(request.headers.get(SECRET_HEADER) ?? "", expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: { callback_query?: TelegramCallbackQuery } = {};
  try {
    update = (await request.json()) as typeof update;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const query = update.callback_query;
  if (query && typeof query.id === "string" && typeof query.data === "string" && query.data.startsWith("ref:")) {
    const admin = createSupabaseAdmin();
    if (admin) {
      try {
        await handleReferralCallback(admin, query);
      } catch (e) {
        console.error("[telegram/webhook] referral callback:", e);
      }
    }
    return NextResponse.json({ ok: true });
  }
  if (query && typeof query.id === "string" && typeof query.data === "string" && query.data.startsWith("pay:")) {
    const admin = createSupabaseAdmin();
    if (!admin) {
      console.error("[telegram/webhook] missing Supabase service role");
      return NextResponse.json({ ok: true });
    }
    try {
      await handlePaymentCallback(admin, query);
    } catch (e) {
      console.error("[telegram/webhook] payment callback:", e);
    }
  }

  // Всегда 200: иначе Telegram повторяет доставку того же обновления.
  return NextResponse.json({ ok: true });
}
