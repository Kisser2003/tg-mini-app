/**
 * Соответствует таблице `public.tracks` (см. supabase/migrations/20260330120000_tracks_table.sql).
 * Для запросов из приложения см. также `ReleaseTrackRow` в `repositories/releases.repo.ts`.
 */
export type DbTrackRow = {
  id: string;
  release_id: string;
  user_id: number;
  title: string;
  /** Публичный URL WAV в Storage (ранее могло называться `audio_url` в других схемах). */
  file_path: string | null;
  index: number;
  explicit: boolean;
  created_at?: string;
};
