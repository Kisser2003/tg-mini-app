-- ============================================================================
-- Hybrid Authentication: Migrate existing tables from bigint to UUID
-- Migration 2/3: Update existing tables to reference public.users(id)
-- ============================================================================
-- This migration adds user_uuid columns and migrates data without data loss.
-- The old telegram_id/user_id columns are kept for backward compatibility.

-- IMPORTANT: This migration is REVERSIBLE and ensures NO DATA LOSS.
-- Old columns are renamed but kept for safety.

-- ===========================================================================
-- STEP 1: Add user_uuid column to all relevant tables
-- ===========================================================================

-- releases table
ALTER TABLE public.releases 
  ADD COLUMN IF NOT EXISTS user_uuid uuid REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS releases_user_uuid_idx ON public.releases(user_uuid);

COMMENT ON COLUMN public.releases.user_uuid IS 
  'FK to public.users.id (UUID). Replaces user_id/telegram_id for hybrid auth.';

-- tracks table  
ALTER TABLE public.tracks 
  ADD COLUMN IF NOT EXISTS user_uuid uuid REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS tracks_user_uuid_idx ON public.tracks(user_uuid);

-- transactions table
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS user_uuid uuid REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS transactions_user_uuid_idx ON public.transactions(user_uuid);

-- payout_accounts table
ALTER TABLE public.payout_accounts 
  ADD COLUMN IF NOT EXISTS user_uuid uuid REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS payout_accounts_user_uuid_idx ON public.payout_accounts(user_uuid);

-- user_preferences table
ALTER TABLE public.user_preferences 
  ADD COLUMN IF NOT EXISTS user_uuid uuid REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_preferences_user_uuid_idx ON public.user_preferences(user_uuid);

-- feedback table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'feedback') THEN
    ALTER TABLE public.feedback 
      ADD COLUMN IF NOT EXISTS user_uuid uuid REFERENCES public.users(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS feedback_user_uuid_idx ON public.feedback(user_uuid);
  END IF;
END
$$;

-- error_logs table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'error_logs' 
             AND column_name = 'user_id') THEN
    ALTER TABLE public.error_logs 
      ADD COLUMN IF NOT EXISTS user_uuid uuid REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- ai_moderation_logs table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'ai_moderation_logs' 
             AND column_name = 'user_id') THEN
    ALTER TABLE public.ai_moderation_logs 
      ADD COLUMN IF NOT EXISTS user_uuid uuid REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- ===========================================================================
-- STEP 2: Data Migration Function
-- ===========================================================================
-- This function will be called by the next migration after users are seeded.
-- It populates user_uuid based on existing telegram_id/user_id values.

CREATE OR REPLACE FUNCTION public.migrate_table_user_ids_to_uuid(
  p_table_name text,
  p_old_column_name text DEFAULT 'user_id',
  p_new_column_name text DEFAULT 'user_uuid'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count integer;
  v_query text;
BEGIN
  -- Build dynamic UPDATE query
  v_query := format(
    'UPDATE public.%I SET %I = u.id
     FROM public.users u
     WHERE %I.%I = u.telegram_id
       AND %I.%I IS NULL
       AND u.telegram_id IS NOT NULL',
    p_table_name,
    p_new_column_name,
    p_table_name,
    p_old_column_name,
    p_table_name,
    p_new_column_name
  );
  
  EXECUTE v_query;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Migrated % rows in %.% -> %', 
    v_updated_count, p_table_name, p_old_column_name, p_new_column_name;
  
  RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION public.migrate_table_user_ids_to_uuid(text, text, text) IS
  'Migrates telegram_id/user_id to user_uuid by looking up public.users. Safe to re-run.';

-- ===========================================================================
-- STEP 3: Create helper view for migration status
-- ===========================================================================

CREATE OR REPLACE VIEW public.migration_status AS
SELECT
  'releases' as table_name,
  count(*) as total_rows,
  count(user_uuid) as migrated_rows,
  count(*) - count(user_uuid) as pending_rows,
  round(100.0 * count(user_uuid) / NULLIF(count(*), 0), 2) as migration_percent
FROM public.releases
WHERE user_id IS NOT NULL OR telegram_id IS NOT NULL

UNION ALL

SELECT
  'tracks' as table_name,
  count(*) as total_rows,
  count(user_uuid) as migrated_rows,
  count(*) - count(user_uuid) as pending_rows,
  round(100.0 * count(user_uuid) / NULLIF(count(*), 0), 2) as migration_percent
FROM public.tracks
WHERE user_id IS NOT NULL

UNION ALL

SELECT
  'transactions' as table_name,
  count(*) as total_rows,
  count(user_uuid) as migrated_rows,
  count(*) - count(user_uuid) as pending_rows,
  round(100.0 * count(user_uuid) / NULLIF(count(*), 0), 2) as migration_percent
FROM public.transactions
WHERE user_id IS NOT NULL

UNION ALL

SELECT
  'user_preferences' as table_name,
  count(*) as total_rows,
  count(user_uuid) as migrated_rows,
  count(*) - count(user_uuid) as pending_rows,
  round(100.0 * count(user_uuid) / NULLIF(count(*), 0), 2) as migration_percent
FROM public.user_preferences
WHERE user_id IS NOT NULL;

COMMENT ON VIEW public.migration_status IS
  'Shows migration progress for each table. 100% = fully migrated to UUID.';

GRANT SELECT ON public.migration_status TO service_role;

-- NOTE: The actual data migration will happen in the next migration file
-- after we seed the public.users table with existing Telegram users.
