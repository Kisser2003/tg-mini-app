-- Hardening pass: normalize RLS policies and remove critical advisor findings.
-- Goals:
-- 1) Ensure RLS is enabled on public.releases.
-- 2) Remove duplicate/permissive policies on key user-facing tables.
-- 3) Make migration_status view security-invoker.
-- 4) Set explicit search_path for mutable functions flagged by advisors.

BEGIN;

-- ---------------------------------------------------------------------------
-- releases: enable RLS + canonical ownership policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'releases'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.releases', pol.policyname);
  END LOOP;
END
$$;

CREATE POLICY releases_select_own ON public.releases
  FOR SELECT
  USING (
    public.is_admin_request()
    OR user_uuid = auth.uid()
    OR trim(coalesce(user_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
    OR trim(coalesce(telegram_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
  );

CREATE POLICY releases_insert_own ON public.releases
  FOR INSERT
  WITH CHECK (
    public.is_admin_request()
    OR user_uuid = auth.uid()
    OR trim(coalesce(user_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
    OR trim(coalesce(telegram_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
  );

CREATE POLICY releases_update_own ON public.releases
  FOR UPDATE
  USING (
    public.is_admin_request()
    OR user_uuid = auth.uid()
    OR trim(coalesce(user_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
    OR trim(coalesce(telegram_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
  )
  WITH CHECK (
    public.is_admin_request()
    OR user_uuid = auth.uid()
    OR trim(coalesce(user_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
    OR trim(coalesce(telegram_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
  );

CREATE POLICY releases_delete_own ON public.releases
  FOR DELETE
  USING (
    public.is_admin_request()
    OR user_uuid = auth.uid()
    OR trim(coalesce(user_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
    OR trim(coalesce(telegram_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
  );

-- ---------------------------------------------------------------------------
-- tracks: canonical ownership policies (remove permissive duplicates)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tracks'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tracks', pol.policyname);
  END LOOP;
END
$$;

CREATE POLICY tracks_select_own ON public.tracks
  FOR SELECT
  USING (
    public.is_admin_request()
    OR user_uuid = auth.uid()
    OR trim(coalesce(user_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
  );

CREATE POLICY tracks_insert_own ON public.tracks
  FOR INSERT
  WITH CHECK (
    public.is_admin_request()
    OR user_uuid = auth.uid()
    OR trim(coalesce(user_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
  );

CREATE POLICY tracks_update_own ON public.tracks
  FOR UPDATE
  USING (
    public.is_admin_request()
    OR user_uuid = auth.uid()
    OR trim(coalesce(user_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
  )
  WITH CHECK (
    public.is_admin_request()
    OR user_uuid = auth.uid()
    OR trim(coalesce(user_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
  );

CREATE POLICY tracks_delete_own ON public.tracks
  FOR DELETE
  USING (
    public.is_admin_request()
    OR user_uuid = auth.uid()
    OR trim(coalesce(user_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
  );

-- ---------------------------------------------------------------------------
-- user_preferences: remove duplicate policies and keep strict ownership checks
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_preferences'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_preferences', pol.policyname);
  END LOOP;
END
$$;

CREATE POLICY user_preferences_select_own ON public.user_preferences
  FOR SELECT
  USING (
    public.is_admin_request()
    OR user_uuid = auth.uid()
    OR trim(coalesce(user_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
  );

CREATE POLICY user_preferences_insert_own ON public.user_preferences
  FOR INSERT
  WITH CHECK (
    public.is_admin_request()
    OR user_uuid = auth.uid()
    OR trim(coalesce(user_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
  );

CREATE POLICY user_preferences_update_own ON public.user_preferences
  FOR UPDATE
  USING (
    public.is_admin_request()
    OR user_uuid = auth.uid()
    OR trim(coalesce(user_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
  )
  WITH CHECK (
    public.is_admin_request()
    OR user_uuid = auth.uid()
    OR trim(coalesce(user_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
  );

-- ---------------------------------------------------------------------------
-- release_logs: keep read-only own/admin access, drop broad or duplicate rules
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'release_logs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.release_logs', pol.policyname);
  END LOOP;
END
$$;

CREATE POLICY release_logs_select_own ON public.release_logs
  FOR SELECT
  USING (
    public.is_admin_request()
    OR EXISTS (
      SELECT 1
      FROM public.releases r
      WHERE r.id = release_logs.release_id
        AND (
          r.user_uuid = auth.uid()
          OR trim(coalesce(r.user_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
          OR trim(coalesce(r.telegram_id::text, '')) = nullif(trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')), '')
        )
    )
  );

-- ---------------------------------------------------------------------------
-- migration_status view: avoid security definer warning
-- ---------------------------------------------------------------------------
ALTER VIEW public.migration_status SET (security_invoker = true);

-- ---------------------------------------------------------------------------
-- mutable search_path advisor findings (skip missing functions — prod schemas vary)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'handle_updated_at',
        'update_users_updated_at',
        'log_release_event',
        'create_release_safe',
        'set_updated_at'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.fn);
  END LOOP;
END
$$;

COMMIT;
