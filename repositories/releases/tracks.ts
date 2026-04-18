import { z } from "zod";
import { logSupabaseTracksInsertRlsDenied, logSupabaseUpdateError } from "../../lib/errors";
import { supabase } from "../../lib/supabase";
import { RELEASE_TYPE_VALUES } from "../../lib/db-enums";
import { withRetry } from "./queries";
import type { ReleaseTrackRow } from "./types";

const trackInsertSchema = z.object({
  releaseId: z.string().min(1),
  userId: z.number().int().nonnegative(),
  /** Как в `releases.telegram_id` — для RLS (x-telegram-user-id). */
  telegramId: z.number().int().nonnegative().optional(),
  index: z.number().int().nonnegative(),
  title: z.string().min(1).max(256).trim(),
  explicit: z.boolean(),
  /** Публичный URL после загрузки в Storage — в БД пишется в колонку `file_path`. */
  audioUrl: z.string().url()
});

export { RELEASE_TYPE_VALUES };

export async function addReleaseTrack(params: {
  releaseId: string;
  userId: number;
  /** Совпадает с `user_id` и заголовком RLS; по умолчанию = userId. */
  telegramId?: number;
  index: number;
  title: string;
  explicit: boolean;
  audioUrl: string;
}): Promise<void> {
  const validated = trackInsertSchema.parse(params);
  const telegramId = validated.telegramId ?? validated.userId;

  const { error } = await withRetry(async () => {
    const response = await supabase.from("tracks").upsert(
      {
        release_id: validated.releaseId,
        user_id: validated.userId,
        telegram_id: telegramId,
        index: validated.index,
        title: validated.title,
        explicit: validated.explicit,
        file_path: validated.audioUrl
      },
      { onConflict: "release_id,index" }
    );
    return response;
  });

  if (error) {
    logSupabaseTracksInsertRlsDenied("addReleaseTrack", error);
    logSupabaseUpdateError("addReleaseTrack", error);
    throw error;
  }
}

export async function cleanupReleaseTracks(releaseId: string): Promise<void> {
  await withRetry(async () => {
    const response = await supabase.from("tracks").delete().eq("release_id", releaseId);
    if (response.error) throw response.error;
    return response;
  });
}

/**
 * Треки релиза из БД (для резюме черновика и отладки).
 * Сортировка по `index` по возрастанию.
 */
export async function getReleaseTracksByReleaseId(releaseId: string): Promise<ReleaseTrackRow[]> {
  const { data, error } = await withRetry(async () => {
    const response = await supabase
      .from("tracks")
      .select("id, release_id, user_id, index, position, title, explicit, file_path, duration")
      .eq("release_id", releaseId)
      .order("index", { ascending: true });
    return response;
  });

  if (error) throw error;

  return (data ?? []) as ReleaseTrackRow[];
}
