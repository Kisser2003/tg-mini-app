-- Колонка названия релиза (если ещё не добавлена в проекте).
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS title text;

UPDATE public.releases
SET title = COALESCE(NULLIF(trim(title), ''), NULLIF(trim(track_name), ''))
WHERE title IS NULL OR trim(title) = '';

-- Bucket для WAV треков (политики Storage для anon + x-telegram-user-id — как у `audio`, через Dashboard при необходимости).
INSERT INTO storage.buckets (id, name, public)
VALUES ('releases', 'releases', true)
ON CONFLICT (id) DO NOTHING;

COMMENT ON COLUMN public.releases.title IS 'Название релиза (основное поле; track_name — legacy).';
