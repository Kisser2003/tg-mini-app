-- ============================================================================
-- Cleanup Migration: Remove Wallet and Unused Tables
-- ============================================================================
-- This migration removes wallet functionality and unused tables.
-- All wallet-related code has been removed from the application.

-- 1. Drop wallet-related tables
DROP TABLE IF EXISTS public.transactions CASCADE;

-- 2. Drop unused tables (created manually, not in use)
DROP TABLE IF EXISTS public.release_tracks CASCADE;
DROP TABLE IF EXISTS public.release_views CASCADE;
DROP TABLE IF EXISTS public.admin_users CASCADE;

-- 3. Drop wallet-related ENUMs
DROP TYPE IF EXISTS public.wallet_transaction_type CASCADE;
DROP TYPE IF EXISTS public.wallet_transaction_status CASCADE;

-- 4. Drop wallet-related functions
DROP FUNCTION IF EXISTS public.get_wallet_balance(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.get_wallet_balance_uuid(uuid) CASCADE;

-- Note: This is a destructive migration. Wallet data has been permanently removed.
-- If you need to restore wallet functionality, use the archived migrations in
-- supabase/migrations/_archived/
