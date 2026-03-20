import { getTelegramUserId } from "./telegram";

export const ADMIN_TELEGRAM_ID = 810176982;

export function getExpectedAdminTelegramId(): number {
  const raw = process.env.ADMIN_TELEGRAM_ID;
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) ? Math.trunc(parsed) : ADMIN_TELEGRAM_ID;
}

/**
 * Показ вкладки «Админ» и клиентских проверок доступа.
 * В `development` на localhost без Telegram — считаем сессию «как админ» для удобства разработки.
 * В production — только реальный Telegram ID администратора.
 */
export function isAdminUi(): boolean {
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  const uid = getTelegramUserId();
  return uid !== null && uid === getExpectedAdminTelegramId();
}
