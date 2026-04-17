-- ============================================================================
-- Hybrid Authentication: Update ALL RLS policies for hybrid auth
-- Migration 4/4: Update RLS policies to support both auth.uid() and Telegram header
-- ============================================================================
-- This migration updates all RLS policies to work with:
-- 1. Supabase Auth (auth.uid()) for web users
-- 2. Telegram header (x-telegram-user-id) for Telegram Mini App users

-- ===========================================================================
-- Helper function: Get current user UUID (hybrid auth aware)
-- ===========================================================================
-- This function is already created in migration 1, but we ensure it's correct

CREATE OR REPLACE FUNCTION public.current_user_uuid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- Try auth.uid() first (Supabase Auth / web login)
    auth.uid(),
    -- Fallback to Telegram ID lookup from header
    public.get_user_id_by_telegram(
      (
        nullif(
          trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
          ''
        )
      )::bigint
    )
  );
$$;

COMMENT ON FUNCTION public.current_user_uuid() IS
  'Returns current user UUID. Works for BOTH Supabase Auth (web) AND Telegram header auth.';

GRANT EXECUTE ON FUNCTION public.current_user_uuid() TO anon, authenticated, service_role;

-- ===========================================================================
-- RELEASES TABLE - Update RLS policies
-- ===========================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can read own releases" ON public.releases;
DROP POLICY IF EXISTS "Users can insert own releases" ON public.releases;
DROP POLICY IF EXISTS "Users can update own releases" ON public.releases;
DROP POLICY IF EXISTS "Users can delete own releases" ON public.releases;
DROP POLICY IF EXISTS "own_releases" ON public.releases;

-- New hybrid auth policies
CREATE POLICY "releases_select_own" ON public.releases
  FOR SELECT
  USING (
    user_uuid = public.current_user_uuid()
    OR
    public.is_admin_request() -- Admin has full access
  );

CREATE POLICY "releases_insert_own" ON public.releases
  FOR INSERT
  WITH CHECK (
    user_uuid = public.current_user_uuid()
    OR
    public.is_admin_request()
  );

CREATE POLICY "releases_update_own" ON public.releases
  FOR UPDATE
  USING (
    user_uuid = public.current_user_uuid()
    OR
    public.is_admin_request()
  )
  WITH CHECK (
    user_uuid = public.current_user_uuid()
    OR
    public.is_admin_request()
  );

CREATE POLICY "releases_delete_own" ON public.releases
  FOR DELETE
  USING (
    user_uuid = public.current_user_uuid()
    OR
    public.is_admin_request()
  );

-- ===========================================================================
-- TRACKS TABLE - Update RLS policies
-- ===========================================================================

DROP POLICY IF EXISTS "Users can read own tracks" ON public.tracks;
DROP POLICY IF EXISTS "Users can insert own tracks" ON public.tracks;
DROP POLICY IF EXISTS "Users can update own tracks" ON public.tracks;
DROP POLICY IF EXISTS "Users can delete own tracks" ON public.tracks;

CREATE POLICY "tracks_select_own" ON public.tracks
  FOR SELECT
  USING (
    user_uuid = public.current_user_uuid()
    OR
    public.is_admin_request()
  );

CREATE POLICY "tracks_insert_own" ON public.tracks
  FOR INSERT
  WITH CHECK (
    user_uuid = public.current_user_uuid()
    OR
    public.is_admin_request()
  );

CREATE POLICY "tracks_update_own" ON public.tracks
  FOR UPDATE
  USING (
    user_uuid = public.current_user_uuid()
    OR
    public.is_admin_request()
  )
  WITH CHECK (
    user_uuid = public.current_user_uuid()
    OR
    public.is_admin_request()
  );

CREATE POLICY "tracks_delete_own" ON public.tracks
  FOR DELETE
  USING (
    user_uuid = public.current_user_uuid()
    OR
    public.is_admin_request()
  );

-- ===========================================================================
-- TRANSACTIONS TABLE - Update RLS policies
-- ===========================================================================

DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;

CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT
  USING (
    user_uuid = public.current_user_uuid()
  );

-- Note: INSERT/UPDATE/DELETE for transactions remains service_role only

-- ===========================================================================
-- PAYOUT_ACCOUNTS TABLE - Update RLS policies
-- ===========================================================================

DROP POLICY IF EXISTS "payout_accounts_select_own" ON public.payout_accounts;

CREATE POLICY "payout_accounts_select_own" ON public.payout_accounts
  FOR SELECT
  USING (
    user_uuid = public.current_user_uuid()
  );

CREATE POLICY "payout_accounts_insert_own" ON public.payout_accounts
  FOR INSERT
  WITH CHECK (
    user_uuid = public.current_user_uuid()
  );

CREATE POLICY "payout_accounts_update_own" ON public.payout_accounts
  FOR UPDATE
  USING (
    user_uuid = public.current_user_uuid()
  )
  WITH CHECK (
    user_uuid = public.current_user_uuid()
  );

-- ===========================================================================
-- USER_PREFERENCES TABLE - Update RLS policies and schema
-- ===========================================================================

-- First, we need to transition user_preferences to use UUID as PK
-- But we'll keep user_id for now for backward compatibility

-- Drop old policy
DROP POLICY IF EXISTS "own_prefs" ON public.user_preferences;

-- Create new hybrid auth policy
CREATE POLICY "user_prefs_select_own" ON public.user_preferences
  FOR SELECT
  USING (
    user_uuid = public.current_user_uuid()
    OR
    user_id = (
      nullif(
        trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
        ''
      )
    )::bigint
  );

CREATE POLICY "user_prefs_insert_own" ON public.user_preferences
  FOR INSERT
  WITH CHECK (
    user_uuid = public.current_user_uuid()
    OR
    user_id = (
      nullif(
        trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
        ''
      )
    )::bigint
  );

CREATE POLICY "user_prefs_update_own" ON public.user_preferences
  FOR UPDATE
  USING (
    user_uuid = public.current_user_uuid()
    OR
    user_id = (
      nullif(
        trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
        ''
      )
    )::bigint
  )
  WITH CHECK (
    user_uuid = public.current_user_uuid()
    OR
    user_id = (
      nullif(
        trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
        ''
      )
    )::bigint
  );

-- ===========================================================================
-- RELEASE_LOGS TABLE - Update RLS policies
-- ===========================================================================

-- Update admin policy (already uses is_admin_request(), so should be OK)
-- But let's also add user access to their own release logs

CREATE POLICY "release_logs_select_own" ON public.release_logs
  FOR SELECT
  USING (
    release_id IN (
      SELECT id FROM public.releases
      WHERE user_uuid = public.current_user_uuid()
    )
    OR
    public.is_admin_request()
  );

-- ===========================================================================
-- FEEDBACK TABLE (if exists) - Update RLS policies
-- ===========================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'feedback') THEN
    
    -- Drop old policies
    EXECUTE 'DROP POLICY IF EXISTS "feedback_select_own" ON public.feedback';
    EXECUTE 'DROP POLICY IF EXISTS "feedback_insert_own" ON public.feedback';
    
    -- Create new hybrid policies
    EXECUTE '
      CREATE POLICY "feedback_select_own" ON public.feedback
        FOR SELECT
        USING (user_uuid = public.current_user_uuid())
    ';
    
    EXECUTE '
      CREATE POLICY "feedback_insert_own" ON public.feedback
        FOR INSERT
        WITH CHECK (user_uuid = public.current_user_uuid())
    ';
  END IF;
END
$$;

-- ===========================================================================
-- Update wallet balance function to work with UUID
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.get_user_balance_uuid(p_user_uuid uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(sum(amount), 0)::numeric
  FROM public.transactions
  WHERE user_uuid = p_user_uuid
    AND status = 'completed'::public.wallet_transaction_status;
$$;

COMMENT ON FUNCTION public.get_user_balance_uuid(uuid) IS 
  'Get balance for user by UUID. Replaces get_user_balance(text) for hybrid auth.';

GRANT EXECUTE ON FUNCTION public.get_user_balance_uuid(uuid) TO anon, authenticated, service_role;

-- Update holding period function if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_balance') THEN
    -- Create UUID version that mirrors the bigint version
    CREATE OR REPLACE FUNCTION public.get_user_balance_uuid(
      p_user_uuid uuid,
      p_only_available boolean DEFAULT false
    )
    RETURNS numeric
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $func$
      SELECT coalesce(sum(amount), 0)::numeric
      FROM public.transactions
      WHERE user_uuid = p_user_uuid
        AND status = 'completed'::public.wallet_transaction_status
        AND (NOT p_only_available OR created_at < now() - interval '60 days');
    $func$;
  END IF;
END
$$;

-- ===========================================================================
-- Create helper for backward compatibility
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.get_telegram_id_from_user_uuid(p_user_uuid uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT telegram_id FROM public.users WHERE id = p_user_uuid LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_telegram_id_from_user_uuid(uuid) IS
  'Get telegram_id for a given user UUID. For backward compatibility.';

GRANT EXECUTE ON FUNCTION public.get_telegram_id_from_user_uuid(uuid) TO anon, authenticated, service_role;

-- ===========================================================================
-- Summary and verification
-- ===========================================================================

DO $$
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Hybrid Auth RLS Policies Updated Successfully';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'All tables now support both:';
  RAISE NOTICE '  1. Supabase Auth (auth.uid()) for web users';
  RAISE NOTICE '  2. Telegram header (x-telegram-user-id) for Mini App';
  RAISE NOTICE '';
  RAISE NOTICE 'Updated tables:';
  RAISE NOTICE '  - releases';
  RAISE NOTICE '  - tracks';
  RAISE NOTICE '  - transactions';
  RAISE NOTICE '  - payout_accounts';
  RAISE NOTICE '  - user_preferences';
  RAISE NOTICE '  - release_logs';
  RAISE NOTICE '  - feedback (if exists)';
  RAISE NOTICE '==================================================';
END
$$;
