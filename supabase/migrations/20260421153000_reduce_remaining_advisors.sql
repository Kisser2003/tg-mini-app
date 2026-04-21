-- Reduce remaining security/performance advisors after hardening pass.
-- - Remove permissive error_logs/storage policies.
-- - Optimize RLS predicates for initplan (auth.uid/current_setting).
-- - Add missing FK indexes.
-- - Remove duplicate indexes on tracks.

BEGIN;

-- ---------------------------------------------------------------------------
-- Helper: stable Telegram header accessor for RLS expressions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_telegram_user_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT nullif(
    trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
    ''
  );
$$;

GRANT EXECUTE ON FUNCTION public.request_telegram_user_id() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- users policies: rewrite with initplan-friendly expressions
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;

CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (
    id = (select auth.uid())
    OR telegram_id::text = (select public.request_telegram_user_id())
  );

CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (
    id = (select auth.uid())
    OR telegram_id::text = (select public.request_telegram_user_id())
  )
  WITH CHECK (
    id = (select auth.uid())
    OR telegram_id::text = (select public.request_telegram_user_id())
  );

-- ---------------------------------------------------------------------------
-- Canonical policies rewritten for initplan advisor
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS releases_select_own ON public.releases;
DROP POLICY IF EXISTS releases_insert_own ON public.releases;
DROP POLICY IF EXISTS releases_update_own ON public.releases;
DROP POLICY IF EXISTS releases_delete_own ON public.releases;

CREATE POLICY releases_select_own ON public.releases
  FOR SELECT
  USING (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
    OR trim(coalesce(user_id::text, '')) = (select public.request_telegram_user_id())
    OR trim(coalesce(telegram_id::text, '')) = (select public.request_telegram_user_id())
  );

CREATE POLICY releases_insert_own ON public.releases
  FOR INSERT
  WITH CHECK (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
    OR trim(coalesce(user_id::text, '')) = (select public.request_telegram_user_id())
    OR trim(coalesce(telegram_id::text, '')) = (select public.request_telegram_user_id())
  );

CREATE POLICY releases_update_own ON public.releases
  FOR UPDATE
  USING (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
    OR trim(coalesce(user_id::text, '')) = (select public.request_telegram_user_id())
    OR trim(coalesce(telegram_id::text, '')) = (select public.request_telegram_user_id())
  )
  WITH CHECK (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
    OR trim(coalesce(user_id::text, '')) = (select public.request_telegram_user_id())
    OR trim(coalesce(telegram_id::text, '')) = (select public.request_telegram_user_id())
  );

CREATE POLICY releases_delete_own ON public.releases
  FOR DELETE
  USING (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
    OR trim(coalesce(user_id::text, '')) = (select public.request_telegram_user_id())
    OR trim(coalesce(telegram_id::text, '')) = (select public.request_telegram_user_id())
  );

DROP POLICY IF EXISTS tracks_select_own ON public.tracks;
DROP POLICY IF EXISTS tracks_insert_own ON public.tracks;
DROP POLICY IF EXISTS tracks_update_own ON public.tracks;
DROP POLICY IF EXISTS tracks_delete_own ON public.tracks;

CREATE POLICY tracks_select_own ON public.tracks
  FOR SELECT
  USING (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
    OR trim(coalesce(user_id::text, '')) = (select public.request_telegram_user_id())
  );

CREATE POLICY tracks_insert_own ON public.tracks
  FOR INSERT
  WITH CHECK (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
    OR trim(coalesce(user_id::text, '')) = (select public.request_telegram_user_id())
  );

CREATE POLICY tracks_update_own ON public.tracks
  FOR UPDATE
  USING (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
    OR trim(coalesce(user_id::text, '')) = (select public.request_telegram_user_id())
  )
  WITH CHECK (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
    OR trim(coalesce(user_id::text, '')) = (select public.request_telegram_user_id())
  );

CREATE POLICY tracks_delete_own ON public.tracks
  FOR DELETE
  USING (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
    OR trim(coalesce(user_id::text, '')) = (select public.request_telegram_user_id())
  );

DROP POLICY IF EXISTS user_preferences_select_own ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_insert_own ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_update_own ON public.user_preferences;

CREATE POLICY user_preferences_select_own ON public.user_preferences
  FOR SELECT
  USING (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
    OR trim(coalesce(user_id::text, '')) = (select public.request_telegram_user_id())
  );

CREATE POLICY user_preferences_insert_own ON public.user_preferences
  FOR INSERT
  WITH CHECK (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
    OR trim(coalesce(user_id::text, '')) = (select public.request_telegram_user_id())
  );

CREATE POLICY user_preferences_update_own ON public.user_preferences
  FOR UPDATE
  USING (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
    OR trim(coalesce(user_id::text, '')) = (select public.request_telegram_user_id())
  )
  WITH CHECK (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
    OR trim(coalesce(user_id::text, '')) = (select public.request_telegram_user_id())
  );

DROP POLICY IF EXISTS release_logs_select_own ON public.release_logs;
CREATE POLICY release_logs_select_own ON public.release_logs
  FOR SELECT
  USING (
    public.is_admin_request()
    OR EXISTS (
      SELECT 1
      FROM public.releases r
      WHERE r.id = release_logs.release_id
        AND (
          r.user_uuid = (select auth.uid())
          OR trim(coalesce(r.user_id::text, '')) = (select public.request_telegram_user_id())
          OR trim(coalesce(r.telegram_id::text, '')) = (select public.request_telegram_user_id())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- error_logs: remove permissive insert=true policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow insert for everyone" ON public.error_logs;
DROP POLICY IF EXISTS "Allow admin to view logs" ON public.error_logs;
DROP POLICY IF EXISTS error_logs_select_admin ON public.error_logs;

CREATE POLICY error_logs_select_admin ON public.error_logs
  FOR SELECT
  USING (public.is_admin_request());

-- Insert path goes through service_role API route; no anon/auth INSERT policy.

-- ---------------------------------------------------------------------------
-- ai_moderation_logs: explicit policy to silence "RLS enabled no policy"
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS ai_moderation_logs_admin_select ON public.ai_moderation_logs;
CREATE POLICY ai_moderation_logs_admin_select ON public.ai_moderation_logs
  FOR SELECT
  USING (public.is_admin_request());

-- ---------------------------------------------------------------------------
-- storage.objects: remove broad public SELECT/listing policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public reads from artwork" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from audio" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload to releases 1pwvt58_1" ON storage.objects;
DROP POLICY IF EXISTS "Give anon users access to JPG images in folder 1jgvrq_0" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Artwork" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Audio" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Objects" ON storage.objects;

-- Keep upload/edit/delete limited to known public buckets used by app.
DROP POLICY IF EXISTS storage_upload_public_buckets ON storage.objects;
DROP POLICY IF EXISTS storage_update_public_buckets ON storage.objects;
DROP POLICY IF EXISTS storage_delete_public_buckets ON storage.objects;

CREATE POLICY storage_upload_public_buckets ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id IN ('artwork', 'audio', 'releases'));

CREATE POLICY storage_update_public_buckets ON storage.objects
  FOR UPDATE
  USING (bucket_id IN ('artwork', 'audio', 'releases'))
  WITH CHECK (bucket_id IN ('artwork', 'audio', 'releases'));

CREATE POLICY storage_delete_public_buckets ON storage.objects
  FOR DELETE
  USING (bucket_id IN ('artwork', 'audio', 'releases'));

-- ---------------------------------------------------------------------------
-- FK/duplicate index cleanup
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS ai_moderation_logs_user_uuid_idx
  ON public.ai_moderation_logs (user_uuid);

CREATE INDEX IF NOT EXISTS error_logs_user_uuid_idx
  ON public.error_logs (user_uuid);

DROP INDEX IF EXISTS public.idx_tracks_release_id;
DROP INDEX IF EXISTS public.tracks_release_id_index_uidx;

COMMIT;
