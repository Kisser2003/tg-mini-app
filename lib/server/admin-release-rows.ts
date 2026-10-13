import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases.repo";
import type { ModerationQueueApiRow } from "@/types/admin";

export const ADMIN_TRACKS_SELECT =
  "id, release_id, user_id, index, position, title, explicit, file_path, lyrics, duration";

/** Раскладывает треки по релизам (сортировка по `index`) и собирает строки очереди/истории. */
export function attachTracksToReleases(
  releases: ReleaseRecord[],
  tracks: ReleaseTrackRow[]
): ModerationQueueApiRow[] {
  const byRelease = new Map<string, ReleaseTrackRow[]>();
  for (const t of tracks) {
    const rid = t.release_id;
    if (rid == null) continue;
    const arr = byRelease.get(rid);
    if (arr) arr.push(t);
    else byRelease.set(rid, [t]);
  }
  for (const arr of byRelease.values()) {
    arr.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  }
  return releases.map((release) => ({ release, tracks: byRelease.get(release.id) ?? [] }));
}

/**
 * Треки для набора релизов одним запросом (вместо запроса на каждый релиз).
 * Возвращает `null` при ошибке Supabase.
 */
export async function loadTracksForReleases(
  supabase: SupabaseClient,
  releaseIds: string[]
): Promise<ReleaseTrackRow[] | null> {
  if (releaseIds.length === 0) return [];
  const { data, error } = await supabase
    .from("tracks")
    .select(ADMIN_TRACKS_SELECT)
    .in("release_id", releaseIds)
    .order("index", { ascending: true });
  if (error) {
    console.error("[admin-release-rows] tracks:", error.message);
    return null;
  }
  return (data ?? []) as unknown as ReleaseTrackRow[];
}
