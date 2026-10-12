-- Baseline: таблица releases и enum release_status.
-- Исходная схема создавалась вручную в дашборде Supabase и не попала в миграции;
-- восстановлена по types/database.types.ts и README, чтобы цепочка миграций накатывалась на пустой проект.
-- user_id здесь bigint (Telegram id) — как в исходной схеме; позже переезд на user_uuid делают миграции 20260417*.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'release_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.release_status AS ENUM ('draft', 'processing', 'ready', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint,
  client_request_id uuid UNIQUE,
  artist_name text,
  track_name text,
  release_type text,
  genre text,
  sub_genre text,
  mood text,
  language text,
  release_date text,
  planned_release_date text,
  explicit boolean DEFAULT false,
  is_explicit boolean,
  audio_url text,
  artwork_url text,
  lyrics text,
  isrc text,
  upc text,
  license_type text,
  p_line text,
  c_line text,
  music_author text,
  author_full_name text,
  moderator_notes text,
  status public.release_status DEFAULT 'draft',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
