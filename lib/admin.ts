import { getTelegramUserId } from "./telegram";

/**
 * Числовой Telegram ID администратора из переменной окружения ADMIN_TELEGRAM_ID.
 * Источник истины в production — таблица `admin_users` в Supabase (RBAC).
 * Эта функция используется только для клиентских проверок (isAdminUi) и
 * серверного скипа проверки подписи initData был удалён — admins now authenticate like regular users.
 */
export function getExpectedAdminTelegramId(): number {
  const raw = process.env.ADMIN_TELEGRAM_ID;
  if (!raw) {
    throw new Error(
      "[admin] ADMIN_TELEGRAM_ID env var is not set. " +
        "Set it to the admin Telegram numeric ID (e.g. ADMIN_TELEGRAM_ID=123456789)."
    );
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `[admin] ADMIN_TELEGRAM_ID="${raw}" is not a valid positive integer.`
    );
  }
  return Math.trunc(parsed);
}

/**
 * Показ вкладки «Админ» и клиентских проверок доступа.
 * В `development` на localhost без Telegram — считаем сессию «как админ» для удобства разработки.
 * В production — только реальный Telegram ID из ADMIN_TELEGRAM_ID env var.
 */
export function isAdminUi(): boolean {
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  const uid = getTelegramUserId();
  if (uid === null) return false;
  try {
    return uid === getExpectedAdminTelegramId();
  } catch {
    return false;
  }
}
