import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  verifyTelegramInitData,
  type VerifiedTelegramInitData,
  type VerifiedTelegramUser,
  type VerifyTelegramInitDataOptions
} from "@/lib/telegram-init-data.server";
import { getTelegramInitDataFromRequest } from "@/lib/api/get-telegram-init-data-from-request";

export type TelegramAuthContext = {
  user: VerifiedTelegramUser;
  authDate: number | null;
};

export type WithTelegramAuthOptions = VerifyTelegramInitDataOptions;

type TelegramAuthHandler = (
  request: NextRequest,
  context: TelegramAuthContext
) => Promise<Response> | Response;

const unauthorized = () =>
  NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

/**
 * Обёртка для App Router API route handlers: проверка подписи `initData` через `TELEGRAM_BOT_TOKEN`.
 * Источник initData: заголовок `X-Telegram-Init-Data` или cookie `tg_init_data`.
 */
export function withTelegramAuth(
  handler: TelegramAuthHandler,
  verifyOptions?: WithTelegramAuthOptions
): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest) => {
    const initDataRaw = getTelegramInitDataFromRequest(request);
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!initDataRaw || !botToken) {
      return unauthorized();
    }

    const verified: VerifiedTelegramInitData | null = verifyTelegramInitData(
      initDataRaw,
      botToken,
      verifyOptions
    );

    if (!verified) {
      return unauthorized();
    }

    return handler(request, {
      user: verified.user,
      authDate: verified.authDate
    });
  };
}
