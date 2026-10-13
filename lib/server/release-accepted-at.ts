import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Когда модератор принял релиз: запись `release_logs` (stage `status`, status `ready`).
 * Отдельной колонки нет; без записи (старые релизы) время берём из даты создания.
 */
export async function logAccepted(admin: SupabaseClient, releaseId: string): Promise<void> {
  const { error } = await admin.from("release_logs").insert({
    release_id: releaseId,
    stage: "status",
    status: "ready",
    error_message: null
  });
  if (error) console.warn("[release-accepted-at] insert:", error.message);
}

export async function loadAcceptedAt(admin: SupabaseClient, releaseIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (releaseIds.length === 0) return out;
  const { data, error } = await admin
    .from("release_logs")
    .select("release_id, created_at")
    .eq("stage", "status")
    .eq("status", "ready")
    .in("release_id", releaseIds)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[release-accepted-at] load:", error.message);
    return out;
  }
  for (const row of (data ?? []) as { release_id: string | null; created_at: string | null }[]) {
    if (row.release_id && row.created_at && !out.has(row.release_id)) out.set(row.release_id, row.created_at);
  }
  return out;
}
