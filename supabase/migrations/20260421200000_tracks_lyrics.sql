-- Текст песни по каждому треку (шаг загрузки WAV в мастере).

BEGIN;

ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS lyrics text;

COMMENT ON COLUMN public.tracks.lyrics IS
  'Лирика / текст трека (опционально), из мастера создания релиза.';

COMMIT;
