import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases.repo";

/** Строка очереди или истории: релиз + треки (GET moderation-queue / moderation-history). */
export type ModerationQueueApiRow = {
  release: ReleaseRecord;
  tracks: ReleaseTrackRow[];
};

export type AdminStatsResponse = {
  ok: true;
  /** Релизы в статусе processing */
  pending_queue: number;
  /** Релизы со статусом ready, созданные с начала текущих суток (UTC) */
  ready_today: number;
};
