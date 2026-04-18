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
const RLS_TELEGRAM_USER_ID_HEADER = "x-telegram-user-id";

/**
 * Dev API bypass (X-Dev-Telegram-User-Id без initData): в `next dev` включён по умолчанию.
 * `ALLOW_DEV_API_AUTH=false` или `NEXT_PUBLIC_ALLOW_DEV_API_AUTH=false` — отключить (строгий режим).
 */
function isDevApiAuthEnabled(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (process.env.ALLOW_DEV_API_AUTH === "false") return false;
  if (process.env.NEXT_PUBLIC_ALLOW_DEV_API_AUTH === "false") return false;
  return true;
}

function logAdminAuthDiagnostics(
  request: NextRequest,
  source: string,
  telegramUserId: number
): void {
  if (process.env.NODE_ENV === "production") return;
  const headerRaw = request.headers.get(RLS_TELEGRAM_USER_ID_HEADER)?.trim() ?? "";
  const envAdminRaw =
    process.env.ADMIN_TELEGRAM_ID?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_TELEGRAM_ID?.trim() ||
    "";
  console.log("[withTelegramAuth] admin-auth diagnostic", {
    source,
    verifiedTelegramUserId: telegramUserId,
    verifiedAsString: String(telegramUserId),
    headerXTelegramUserId: headerRaw.length > 0 ? headerRaw : null,
    headerAsString: headerRaw.length > 0 ? String(headerRaw) : null,
    envAdminTelegramId: envAdminRaw.length > 0 ? envAdminRaw : null,
    envAdminAsString: envAdminRaw.length > 0 ? String(envAdminRaw) : null,
    headerMatchesEnvAdmin:
      envAdminRaw.length > 0 &&
      headerRaw.length > 0 &&
      String(headerRaw) === String(envAdminRaw),
    verifiedMatchesEnvAdmin:
      envAdminRaw.length > 0 && String(telegramUserId) === String(envAdminRaw)
  });
}

function tryDevTelegramUserIdBypass(request: NextRequest): TelegramAuthContext | null {
  if (!isDevApiAuthEnabled()) return null;
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
 * Тот же контекст, что и в `withTelegramAuth`, но без вызова handler — для гибридных маршрутов
 * (например сборка WAV после чанков для веб-сессии Supabase без Telegram initData).
 */
export function getTelegramAuthContextFromRequest(
  request: NextRequest,
  verifyOptions?: WithTelegramAuthOptions
): TelegramAuthContext | null {
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
      logAdminAuthDiagnostics(request, "dev-bypass-no-initData", devCtx.user.id);
      return devCtx;
    }
    return null;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.warn("[withTelegramAuth] missing TELEGRAM_BOT_TOKEN (non-admin user)");
    return null;
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
      isDevApiAuthEnabled() &&
      looseOnFail &&
      devIdRaw &&
      Number(devIdRaw) === looseOnFail.user.id
    ) {
      console.warn(
        "[withTelegramAuth] DEV bypass: initData verify failed; user id matches X-Dev-Telegram-User-Id"
      );
      logAdminAuthDiagnostics(request, "dev-bypass-initData-verify-failed", looseOnFail.user.id);
      return {
        user: looseOnFail.user,
        authDate: looseOnFail.authDate
      };
    }
    console.warn("[withTelegramAuth] initData signature verification failed or auth_date stale");
    return null;
  }

  logAdminAuthDiagnostics(request, "initData-verified", verified.user.id);
  return {
    user: verified.user,
    authDate: verified.authDate
  };
}

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
    const ctx = getTelegramAuthContextFromRequest(request, verifyOptions);
    if (!ctx) {
      if (!getTelegramInitDataFromRequest(request)) {
        console.warn("[withTelegramAuth] missing initData (header/cookie)");
      }
      return unauthorized();
    }
    return handler(request, ctx);
  };
}
