import { mutate } from "swr";
import { createSupabaseBrowser } from "@/lib/supabase";
import { getTelegramUserIdForSupabaseRequests } from "@/lib/telegram";
import type { ReleaseRecord } from "@/repositories/releases.repo";

/** Совпадает с `ReleaseListRow` в `useReleases` — без импорта оттуда (избегаем цикла с actions). */
type ReleasesListCacheRow = Pick<
  ReleaseRecord,
  | "id"
  | "title"
  | "track_name"
  | "artwork_url"
  | "status"
  | "created_at"
  | "error_message"
  | "admin_notes"
  | "draft_upload_started"
  | "isrc"
>;

function toCacheRow(r: ReleaseRecord): ReleasesListCacheRow {
  return {
    id: r.id,
    title: r.title,
    track_name: r.track_name,
    artwork_url: r.artwork_url,
    status: r.status,
    created_at: r.created_at,
    error_message: r.error_message,
    admin_notes: r.admin_notes,
    draft_upload_started: r.draft_upload_started,
    isrc: r.isrc
  };
}

/**
 * После успешной отправки релиза обновить кэш SWR списка библиотеки,
 * иначе до revalidate (или фокуса) остаётся старый статус draft/pending.
 */
export async function refreshReleasesListAfterSubmit(updated: ReleaseRecord): Promise<void> {
  if (typeof window === "undefined") return;

  const row = toCacheRow(updated);

  /** Один пользователь Mini App может успеть попасть в web-кэш до появления initData — обновляем оба ключа. */
  const keys: [string, string, string][] = [];
  const tid = getTelegramUserIdForSupabaseRequests();
  if (tid != null) {
    keys.push(["releases", "telegram", String(tid)]);
  }
  const {
    data: { session }
  } = await createSupabaseBrowser().auth.getSession();
  if (session?.user?.id) {
    keys.push(["releases", "web", session.user.id]);
  }
  if (keys.length === 0) return;

  const seen = new Set<string>();
  for (const key of keys) {
    const sig = key.join("\0");
    if (seen.has(sig)) continue;
    seen.add(sig);

    await mutate(
      key,
      (current: ReleasesListCacheRow[] | undefined) => {
        if (current === undefined || current.length === 0) {
          return [row];
        }
        const i = current.findIndex((r) => r.id === row.id);
        if (i === -1) {
          return [row, ...current];
        }
        const next = [...current];
        next[i] = { ...next[i], ...row };
        return next;
      },
      { revalidate: true }
    );
  }
}
