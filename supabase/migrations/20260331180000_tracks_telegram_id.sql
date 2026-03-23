-- Telegram id в tracks (как в releases): клиент передаёт user_id и telegram_id = x-telegram-user-id для RLS.

ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS telegram_id bigint;

UPDATE public.tracks
SET telegram_id = user_id
WHERE telegram_id IS NULL;

COMMENT ON COLUMN public.tracks.telegram_id IS 'Telegram user id (дублирует user_id для политик; как в releases).';

DROP POLICY IF EXISTS "tracks_select_own" ON public.tracks;
DROP POLICY IF EXISTS "tracks_insert_own" ON public.tracks;
DROP POLICY IF EXISTS "tracks_update_own" ON public.tracks;
DROP POLICY IF EXISTS "tracks_delete_own" ON public.tracks;
DROP POLICY IF EXISTS "Admin full access to ALL tracks" ON public.tracks;

CREATE POLICY "tracks_select_own" ON public.tracks FOR SELECT USING (
  user_id = (
    nullif(
      trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
      ''
    )
  )::bigint
);

CREATE POLICY "tracks_insert_own" ON public.tracks FOR INSERT WITH CHECK (
  user_id = (
    nullif(
      trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
      ''
    )
  )::bigint
  AND telegram_id = (
    nullif(
      trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
      ''
    )
  )::bigint
);

CREATE POLICY "tracks_update_own" ON public.tracks FOR UPDATE USING (
  user_id = (
    nullif(
      trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
      ''
    )
  )::bigint
) WITH CHECK (
  user_id = (
    nullif(
      trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
      ''
    )
  )::bigint
  AND telegram_id = (
    nullif(
      trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
      ''
    )
  )::bigint
);

CREATE POLICY "tracks_delete_own" ON public.tracks FOR DELETE USING (
  user_id = (
    nullif(
      trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
      ''
    )
  )::bigint
);

CREATE POLICY "Admin full access to ALL tracks" ON public.tracks FOR ALL USING (
  coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')
  = '810176982'
) WITH CHECK (
  coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')
  = '810176982'
);

COMMENT ON POLICY "tracks_insert_own" ON public.tracks IS
  'INSERT: user_id и telegram_id совпадают с x-telegram-user-id (anon + RLS).';
