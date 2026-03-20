import type { NextRequest } from "next/server";

export const TELEGRAM_INIT_DATA_HEADER = "x-telegram-init-data";
const INIT_DATA_COOKIE = "tg_init_data";

/**
 * Извлекает сырой query-string initData из запроса (как в Telegram.WebApp.initData).
 * Приоритет: заголовок `X-Telegram-Init-Data`, затем cookie `tg_init_data` (см. `lib/telegram.ts`, `initTelegramWebApp`).
 */
export function getTelegramInitDataFromRequest(request: NextRequest): string | null {
  const fromHeader = request.headers.get(TELEGRAM_INIT_DATA_HEADER)?.trim();
  if (fromHeader && fromHeader.length > 0) {
    return fromHeader;
  }

  const rawCookie = request.cookies.get(INIT_DATA_COOKIE)?.value;
  if (!rawCookie || rawCookie.length === 0) {
    return null;
  }

  try {
    return decodeURIComponent(rawCookie);
  } catch {
    return null;
  }
}
