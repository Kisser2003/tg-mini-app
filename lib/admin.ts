import { getTelegramApiAuthHeaders, getTelegramUserId } from "./telegram";

function parsePositiveTelegramId(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

/**
 * Сравнение Telegram ID без сюрпризов от типов (number vs string из заголовков / env).
 */
export function telegramIdsEqual(a: number, b: number): boolean {
  return String(a) === String(b);
}

/**
 * Сырой ID админа из env. На сервере доступны обе переменные; в браузерном бандле Next
 * подставляется только `NEXT_PUBLIC_*`, поэтому для UI в production нужен
 * `NEXT_PUBLIC_ADMIN_TELEGRAM_ID` (тот же числовой ID, что и `ADMIN_TELEGRAM_ID`).
 */
function readAdminTelegramIdRawForServer(): string {
  return (
    process.env.ADMIN_TELEGRAM_ID?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_TELEGRAM_ID?.trim() ||
    ""
  );
}

/**
 * ID админа для клиентского UI (вкладка «Админ», редирект startapp=admin).
 * В браузере сначала `NEXT_PUBLIC_ADMIN_TELEGRAM_ID`, иначе сравнение с env невозможно.
 */
export function getAdminTelegramIdForUi(): number | null {
  if (typeof window === "undefined") {
    return parsePositiveTelegramId(readAdminTelegramIdRawForServer());
  }
  const raw =
    process.env.NEXT_PUBLIC_ADMIN_TELEGRAM_ID?.trim() ||
    process.env.ADMIN_TELEGRAM_ID?.trim() ||
    "";
  return parsePositiveTelegramId(raw);
}

/**
 * Числовой Telegram ID администратора для серверных API (строго: должно быть задано в env).
 * Принимает `ADMIN_TELEGRAM_ID` или, как запасной вариант, `NEXT_PUBLIC_ADMIN_TELEGRAM_ID`
 * (одинаковое значение на Vercel).
 */
export function getExpectedAdminTelegramId(): number {
  const raw = readAdminTelegramIdRawForServer();
  if (!raw) {
    throw new Error(
      "[admin] Set ADMIN_TELEGRAM_ID (and for client Admin UI also NEXT_PUBLIC_ADMIN_TELEGRAM_ID) " +
        "to the admin Telegram numeric ID."
    );
  }
  const parsed = parsePositiveTelegramId(raw);
  if (parsed === null) {
    throw new Error(`[admin] Admin Telegram ID "${raw}" is not a valid positive integer.`);
  }
  return parsed;
}

/**
 * Показ вкладки «Админ» и клиентских проверок доступа.
 * В `development` на localhost — всегда true для удобства.
 * В production — сравнение ID через строки; env для браузера: `NEXT_PUBLIC_ADMIN_TELEGRAM_ID`.
 */
export function isAdminUi(): boolean {
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  const uid = getTelegramUserId();
  if (uid === null) return false;
  const adminId = getAdminTelegramIdForUi();
  if (adminId === null) return false;
  return telegramIdsEqual(uid, adminId);
}

/**
 * Заголовки для админских API (`withTelegramAuth` + проверка admin ID).
 * В `next dev` в обычном браузере без Mini App подставляется `X-Dev-Telegram-User-Id`
 * из `NEXT_PUBLIC_ADMIN_TELEGRAM_ID`, иначе по умолчанию уходит `1` и сервер отвечает 403.
 */
export function getTelegramApiAuthHeadersForAdminApi(): Record<string, string> {
  const uid = getTelegramUserId();
  if (uid != null) {
    return getTelegramApiAuthHeaders();
  }
  const adminId = getAdminTelegramIdForUi();
  if (process.env.NODE_ENV === "development" && adminId != null) {
    return getTelegramApiAuthHeaders({ userId: adminId });
  }
  return getTelegramApiAuthHeaders();
}
