export const ADMIN_TELEGRAM_ID = 810176982;

export function getExpectedAdminTelegramId(): number {
  const raw = process.env.ADMIN_TELEGRAM_ID;
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) ? Math.trunc(parsed) : ADMIN_TELEGRAM_ID;
}
