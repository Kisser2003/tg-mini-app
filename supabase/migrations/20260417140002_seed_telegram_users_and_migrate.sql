-- ============================================================================
-- Hybrid Authentication: Seed existing Telegram users and migrate data
-- Migration 3/3: Create auth.users for existing Telegram users, populate public.users
-- ============================================================================
-- This migration creates auth.users entries for all existing Telegram users
-- and migrates all data to use UUID references.

-- IMPORTANT: This is safe to re-run (idempotent)

-- ===========================================================================
-- STEP 1: Create auth.users for existing Telegram users (if not exists)
-- ===========================================================================
-- We create "synthetic" auth.users for Telegram-only users.
-- Password is set to a random UUID (they won't use password login initially).

DO $$
DECLARE
  v_telegram_user RECORD;
  v_user_uuid uuid;
  v_email text;
  v_encrypted_password text;
BEGIN
  CREATE TEMP TABLE _tg_seed_candidates (
    telegram_id bigint,
    telegram_username text
  ) ON COMMIT DROP;

  INSERT INTO _tg_seed_candidates
  SELECT
    COALESCE(telegram_id::bigint, user_id::bigint),
    telegram_username
  FROM public.releases
  WHERE COALESCE(telegram_id, user_id) IS NOT NULL;

  INSERT INTO _tg_seed_candidates
  SELECT user_id, NULL
  FROM public.user_preferences
  WHERE user_id IS NOT NULL;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_tables
    WHERE schemaname = 'public' AND tablename = 'transactions'
  ) THEN
    INSERT INTO _tg_seed_candidates
    SELECT user_id, NULL
    FROM public.transactions
    WHERE user_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_tables
    WHERE schemaname = 'public' AND tablename = 'admin_users'
  ) THEN
    INSERT INTO _tg_seed_candidates
    SELECT telegram_id, NULL
    FROM public.admin_users
    WHERE telegram_id IS NOT NULL;
  END IF;

  FOR v_telegram_user IN (
    SELECT DISTINCT ON (telegram_id)
      telegram_id,
      telegram_username,
      NULL::text AS telegram_first_name,
      NULL::text AS telegram_last_name
    FROM _tg_seed_candidates
    WHERE telegram_id IS NOT NULL
    ORDER BY telegram_id
  ) LOOP
    -- Check if user already exists in public.users
    SELECT id INTO v_user_uuid
    FROM public.users
    WHERE telegram_id = v_telegram_user.telegram_id;
    
    IF v_user_uuid IS NOT NULL THEN
      -- User already migrated, skip
      CONTINUE;
    END IF;
    
    -- Generate a synthetic email for Telegram users (they can change it later)
    v_email := 'telegram_' || v_telegram_user.telegram_id || '@temp.local';
    
    -- Check if auth.users already exists with this email
    SELECT id INTO v_user_uuid
    FROM auth.users
    WHERE email = v_email;
    
    IF v_user_uuid IS NULL THEN
      -- Create new auth.users entry
      v_user_uuid := gen_random_uuid();
      v_encrypted_password := crypt(gen_random_uuid()::text, gen_salt('bf'));
      
      INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        aud,
        role,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      ) VALUES (
        v_user_uuid,
        '00000000-0000-0000-0000-000000000000',
        v_email,
        v_encrypted_password,
        now(), -- Email confirmed (synthetic account)
        jsonb_build_object('provider', 'telegram', 'providers', ARRAY['telegram']),
        jsonb_build_object(
          'telegram_id', v_telegram_user.telegram_id,
          'telegram_username', v_telegram_user.telegram_username,
          'is_synthetic', true
        ),
        'authenticated',
        'authenticated',
        now(),
        now(),
        '',
        '',
        '',
        ''
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
    
    -- Create/update public.users entry
    INSERT INTO public.users (
      id,
      telegram_id,
      telegram_username,
      email,
      display_name,
      created_at,
      updated_at
    ) VALUES (
      v_user_uuid,
      v_telegram_user.telegram_id,
      v_telegram_user.telegram_username,
      v_email,
      COALESCE(
        '@' || v_telegram_user.telegram_username,
        'User ' || v_telegram_user.telegram_id
      ),
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      telegram_id = EXCLUDED.telegram_id,
      telegram_username = COALESCE(EXCLUDED.telegram_username, public.users.telegram_username),
      updated_at = now()
    WHERE public.users.telegram_id IS NULL; -- Only update if not set
    
    RAISE NOTICE 'Created/updated user for Telegram ID: %', v_telegram_user.telegram_id;
  END LOOP;
  
  RAISE NOTICE 'Telegram user seeding completed';
END
$$;

-- ===========================================================================
-- STEP 2: Migrate all tables to use user_uuid
-- ===========================================================================

-- Migrate releases (handle both user_id and telegram_id columns)
UPDATE public.releases r
SET user_uuid = u.id
FROM public.users u
WHERE r.user_uuid IS NULL
  AND u.telegram_id = COALESCE(r.telegram_id::bigint, r.user_id::bigint);

-- Migrate tracks (user_id is bigint)
UPDATE public.tracks t
SET user_uuid = u.id
FROM public.users u
WHERE t.user_uuid IS NULL
  AND t.user_id IS NOT NULL
  AND u.telegram_id = t.user_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_tables
    WHERE schemaname = 'public' AND tablename = 'transactions'
  ) THEN
    UPDATE public.transactions t
    SET user_uuid = u.id
    FROM public.users u
    WHERE t.user_uuid IS NULL
      AND t.user_id IS NOT NULL
      AND u.telegram_id = t.user_id;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_tables
    WHERE schemaname = 'public' AND tablename = 'payout_accounts'
  ) THEN
    UPDATE public.payout_accounts p
    SET user_uuid = u.id
    FROM public.users u
    WHERE p.user_uuid IS NULL
      AND p.user_id IS NOT NULL
      AND u.telegram_id = p.user_id;
  END IF;
END
$$;

-- Migrate user_preferences (convert to UUID-based primary key)
-- First, add user_uuid and populate it
UPDATE public.user_preferences up
SET user_uuid = u.id
FROM public.users u
WHERE up.user_uuid IS NULL
  AND up.user_id IS NOT NULL
  AND u.telegram_id = up.user_id;

-- Migrate feedback table if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'feedback') THEN
    EXECUTE '
      UPDATE public.feedback f
      SET user_uuid = u.id
      FROM public.users u
      WHERE f.user_uuid IS NULL
        AND f.user_id IS NOT NULL
        AND u.telegram_id = f.user_id::bigint
    ';
  END IF;
END
$$;

-- Migrate error_logs if has user_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'error_logs' 
             AND column_name = 'user_id'
             AND column_name = 'user_uuid') THEN
    EXECUTE '
      UPDATE public.error_logs e
      SET user_uuid = u.id::text::uuid
      FROM public.users u
      WHERE e.user_uuid IS NULL
        AND e.user_id IS NOT NULL
        AND u.id::text = e.user_id
    ';
  END IF;
END
$$;

-- Migrate ai_moderation_logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'ai_moderation_logs' 
             AND column_name = 'user_id'
             AND column_name = 'user_uuid') THEN
    EXECUTE '
      UPDATE public.ai_moderation_logs a
      SET user_uuid = u.id
      FROM public.users u
      WHERE a.user_uuid IS NULL
        AND a.user_id IS NOT NULL
        AND u.telegram_id = a.user_id
    ';
  END IF;
END
$$;

-- ===========================================================================
-- STEP 3: Report migration status
-- ===========================================================================

DO $$
DECLARE
  v_status RECORD;
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Migration Status Report';
  RAISE NOTICE '==================================================';
  
  FOR v_status IN SELECT * FROM public.migration_status ORDER BY table_name LOOP
    RAISE NOTICE '% : % / % rows migrated (% %%)',
      rpad(v_status.table_name, 20),
      v_status.migrated_rows,
      v_status.total_rows,
      v_status.migration_percent;
  END LOOP;
  
  RAISE NOTICE '==================================================';
END
$$;

-- ===========================================================================
-- STEP 4: Create function for manual remigration if needed
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.remigrate_all_user_data()
RETURNS TABLE(
  table_name text,
  rows_updated integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 'releases'::text, migrate_table_user_ids_to_uuid('releases', 'user_id', 'user_uuid');

  RETURN QUERY
  SELECT 'releases_telegram'::text, migrate_table_user_ids_to_uuid('releases', 'telegram_id', 'user_uuid');

  RETURN QUERY
  SELECT 'tracks'::text, migrate_table_user_ids_to_uuid('tracks', 'user_id', 'user_uuid');

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_tables
    WHERE schemaname = 'public' AND tablename = 'transactions'
  ) THEN
    RETURN QUERY
    SELECT 'transactions'::text, migrate_table_user_ids_to_uuid('transactions', 'user_id', 'user_uuid');
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_tables
    WHERE schemaname = 'public' AND tablename = 'payout_accounts'
  ) THEN
    RETURN QUERY
    SELECT 'payout_accounts'::text, migrate_table_user_ids_to_uuid('payout_accounts', 'user_id', 'user_uuid');
  END IF;

  RETURN QUERY
  SELECT 'user_preferences'::text, migrate_table_user_ids_to_uuid('user_preferences', 'user_id', 'user_uuid');
END;
$$;

COMMENT ON FUNCTION public.remigrate_all_user_data() IS
  'Re-runs migration for all tables. Safe to call multiple times. Returns rows updated per table.';

GRANT EXECUTE ON FUNCTION public.remigrate_all_user_data() TO service_role;
