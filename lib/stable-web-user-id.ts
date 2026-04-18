/**
 * Стабильный положительный числовой id для путей Storage и колонок user_id у веб-пользователя
 * без привязанного Telegram (JWT Supabase). Диапазон 9e9+ не пересекается с реальными Telegram id.
 */
export function stableNumericIdFromAuthUserId(authUserId: string): number {
  const hex = authUserId.replace(/-/g, "").slice(0, 12);
  const n = parseInt(hex, 16);
  if (!Number.isFinite(n)) return 9_000_000_001;
  return 9_000_000_000 + (n % 1_000_000_000);
}
