-- Таблица треков релиза: имя `tracks` (не `release_tracks`).
-- Колонки: id, release_id, user_id, title, file_path (URL или путь к WAV в Storage),
-- плюс index, explicit для логики приложения и upsert.

CREATE TABLE IF NOT EXISTS public.tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.releases (id) ON DELETE CASCADE,
  user_id bigint NOT NULL,
  title text NOT NULL,
  file_path text,
  index integer NOT NULL DEFAULT 0,
  explicit boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Если таблица уже была создана вручную без index/explicit — добавить.
ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS index integer NOT NULL DEFAULT 0;

ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS explicit boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS tracks_release_id_index_uidx ON public.tracks (release_id, index);

CREATE INDEX IF NOT EXISTS tracks_release_id_idx ON public.tracks (release_id);

COMMENT ON TABLE public.tracks IS
  'Треки релиза: user_id — Telegram; file_path — публичный URL аудио; index — порядок (0..n).';
