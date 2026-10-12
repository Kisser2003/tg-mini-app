-- Структурированные причины отклонения и счётчик попыток модерации.
ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS rejection_reasons text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rejection_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.releases.rejection_reasons IS 'Ключи причин последнего отклонения (caps, quality, artwork, ...).';
COMMENT ON COLUMN public.releases.rejection_count IS 'Сколько раз релиз был отклонён модератором.';
