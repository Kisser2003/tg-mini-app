-- Колонки и значения enum, которые использует код, но которых не было в миграциях
-- (в старом проде они были созданы вручную в дашборде).
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS authors text, ADD COLUMN IF NOT EXISTS splits text;
ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS position integer, ADD COLUMN IF NOT EXISTS duration numeric;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';
ALTER TYPE public.release_status ADD VALUE IF NOT EXISTS 'review';
