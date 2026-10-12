import { deleteJsonCache } from "@/lib/server/redis-cache";

/** Сбросить кэш списка «Мои релизы» после смены статуса (иначе до 20 с видно старое). */
export async function invalidateMyReleasesCache(row: Record<string, unknown>): Promise<void> {
  const keys: string[] = [];
  for (const field of ["telegram_id", "user_id"] as const) {
    const v = row[field];
    if (v != null && /^\d+$/.test(String(v))) keys.push(`releases:my:tg:${String(v)}`);
  }
  const uu = row.user_uuid;
  if (typeof uu === "string" && uu) keys.push(`releases:my:web:${uu}`);
  await Promise.all(Array.from(new Set(keys)).map((k) => deleteJsonCache(k)));
}
