-- Совместимость: ручная таблица могла иметь audio_url вместо file_path.
-- RLS: доступ к строкам tracks по x-telegram-user-id (как у releases).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tracks'
      AND column_name = 'audio_url'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tracks'
      AND column_name = 'file_path'
  ) THEN
    ALTER TABLE public.tracks RENAME COLUMN audio_url TO file_path;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS tracks_release_id_index_uidx ON public.tracks (release_id, index);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

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

COMMENT ON POLICY "tracks_select_own" ON public.tracks IS
  'Чтение строк tracks владельцем по заголовку x-telegram-user-id.';
