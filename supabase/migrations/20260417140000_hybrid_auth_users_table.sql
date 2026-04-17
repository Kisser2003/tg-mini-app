-- ============================================================================
-- Hybrid Authentication: Telegram + Web (Email/Password)
-- Migration 1/3: Create public.users table linked to auth.users
-- ============================================================================
-- This migration creates the bridge between Telegram Mini App auth and Web auth
-- using Supabase auth.users as the single source of truth.

-- 1. Create public.users table that maps to auth.users.id (UUID)
CREATE TABLE IF NOT EXISTS public.users (
  -- Primary key maps 1:1 with auth.users.id
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Telegram identity (nullable, unique when set)
  telegram_id bigint UNIQUE,
  telegram_username text,
  telegram_first_name text,
  telegram_last_name text,
  telegram_photo_url text,
  telegram_is_premium boolean DEFAULT false,
  telegram_language_code text,
  
  -- Email identity (synced from auth.users.email)
  email text UNIQUE,
  
  -- Display name (fallback: telegram_first_name || email)
  display_name text,
  
  -- Account linking metadata
  account_linked_at timestamptz,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.users IS 
  'User profiles linked to auth.users. Supports both Telegram and Email/Password auth.';
COMMENT ON COLUMN public.users.id IS 
  'Maps 1:1 with auth.users.id (UUID). Single source of truth.';
COMMENT ON COLUMN public.users.telegram_id IS 
  'Telegram user ID (bigint). Nullable and unique. NULL for web-only users.';
COMMENT ON COLUMN public.users.email IS 
  'User email, synced from auth.users.email. NULL for Telegram-only users.';

-- 2. Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS users_telegram_id_idx ON public.users(telegram_id) 
  WHERE telegram_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email) 
  WHERE email IS NOT NULL;

-- 3. Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for public.users
-- Users can read their own profile via auth.uid() OR x-telegram-user-id header
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  USING (
    -- Authenticated via Supabase Auth (web)
    auth.uid() = id
    OR
    -- Authenticated via Telegram (header-based)
    telegram_id = (
      nullif(
        trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
        ''
      )
    )::bigint
  );

-- Users can update their own profile
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  USING (
    auth.uid() = id
    OR
    telegram_id = (
      nullif(
        trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
        ''
      )
    )::bigint
  )
  WITH CHECK (
    auth.uid() = id
    OR
    telegram_id = (
      nullif(
        trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
        ''
      )
    )::bigint
  );

-- 5. Trigger: Auto-insert row in public.users when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- 6. Function: Sync email from auth.users to public.users
CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET 
    email = NEW.email,
    updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_user_email();

-- 7. Trigger: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_users_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_users_updated_at();

-- 8. Helper function: Get user UUID by Telegram ID
CREATE OR REPLACE FUNCTION public.get_user_id_by_telegram(p_telegram_id bigint)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE telegram_id = p_telegram_id LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_id_by_telegram(bigint) IS
  'Returns user UUID for a given Telegram ID. Returns NULL if not found.';

-- 9. Helper function: Get current user UUID (works for both auth types)
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- Try auth.uid() first (web login)
    auth.uid(),
    -- Fallback to Telegram ID lookup
    (
      SELECT id FROM public.users
      WHERE telegram_id = (
        nullif(
          trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
          ''
        )
      )::bigint
      LIMIT 1
    )
  );
$$;

COMMENT ON FUNCTION public.get_current_user_id() IS
  'Returns current user UUID. Works for both Supabase Auth and Telegram header auth.';

-- 10. Grant permissions
GRANT SELECT, UPDATE ON public.users TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_telegram(bigint) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_user_id() TO anon, authenticated, service_role;
