import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  parseTelegramInitDataWithoutVerification,
  verifyTelegramInitData,
  type VerifiedTelegramInitData,
  type VerifiedTelegramUser,
  type VerifyTelegramInitDataOptions
} from "@/lib/telegram-init-data.server";
import { getTelegramInitDataFromRequest } from "@/lib/api/get-telegram-init-data-from-request";

const DEV_USER_ID_HEADER = "x-dev-telegram-user-id";

function tryDevTelegramUserIdBypass(request: NextRequest): TelegramAuthContext | null {
  if (process.env.NODE_ENV !== "development") return null;
  if (process.env.ALLOW_DEV_API_AUTH !== "true") return null;
  const raw = request.headers.get(DEV_USER_ID_HEADER)?.trim();
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return null;
  console.warn("[withTelegramAuth] DEV bypass: no initData, X-Dev-Telegram-User-Id", id);
  return {
    user: { id: Math.trunc(id) },
    authDate: null
  };
}

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
 * Все пользователи, включая администраторов, проходят полную HMAC-верификацию initData.
 */
export function withTelegramAuth(
  handler: TelegramAuthHandler,
  verifyOptions?: WithTelegramAuthOptions
): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest) => {
    const initDataRaw = getTelegramInitDataFromRequest(request);

    if (process.env.NODE_ENV === "development") {
      console.debug("[withTelegramAuth]", {
        hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
        receivedData: Boolean(initDataRaw)
      });
    }

    if (!initDataRaw) {
      const devCtx = tryDevTelegramUserIdBypass(request);
      if (devCtx) {
        return handler(request, devCtx);
      }
      console.warn("[withTelegramAuth] missing initData (header/cookie)");
      return unauthorized();
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      console.warn("[withTelegramAuth] missing TELEGRAM_BOT_TOKEN (non-admin user)");
      return unauthorized();
    }

    const verified: VerifiedTelegramInitData | null = verifyTelegramInitData(
      initDataRaw,
      botToken,
      verifyOptions
    );

    if (!verified) {
      const looseOnFail = parseTelegramInitDataWithoutVerification(initDataRaw);
      const devIdRaw = request.headers.get(DEV_USER_ID_HEADER)?.trim();
      if (
        process.env.NODE_ENV === "development" &&
        process.env.ALLOW_DEV_API_AUTH === "true" &&
        looseOnFail &&
        devIdRaw &&
        Number(devIdRaw) === looseOnFail.user.id
      ) {
        console.warn(
          "[withTelegramAuth] DEV bypass: initData verify failed; user id matches X-Dev-Telegram-User-Id"
        );
        return handler(request, {
          user: looseOnFail.user,
          authDate: looseOnFail.authDate
        });
      }
      console.warn("[withTelegramAuth] initData signature verification failed or auth_date stale");
      return unauthorized();
    }

    return handler(request, {
      user: verified.user,
      authDate: verified.authDate
    });
  };
}
