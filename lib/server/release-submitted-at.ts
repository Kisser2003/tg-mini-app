import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Когда релиз последний раз ушёл на проверку: последняя запись `finalize` в `release_logs`
 * (её пишет RPC finalize_release). Отдельной колонки в `releases` нет.
 * Ошибки не роняют вызывающий код: без времени показываем общий текст.
 */
export async function loadSubmittedAt(
  admin: SupabaseClient,
  releaseIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (releaseIds.length === 0) return out;
  const { data, error } = await admin
    .from("release_logs")
    .select("release_id, created_at")
    .eq("stage", "finalize")
    .in("release_id", releaseIds)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[release-submitted-at]", error.message);
    return out;
  }
  for (const row of (data ?? []) as { release_id: string | null; created_at: string | null }[]) {
    if (!row.release_id || !row.created_at) continue;
    if (!out.has(row.release_id)) out.set(row.release_id, row.created_at);
  }
  return out;
}
