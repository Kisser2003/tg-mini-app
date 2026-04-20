-- ============================================================================
-- Fix: admin_users удалена в 20260417180000, но RLS (20260417140003) всё ещё
-- вызывает public.is_admin_request() → "relation public.admin_users does not exist".
-- Заменяем тело функции на stub (всегда false): админ через anon key отключён;
-- админка — только service role / API routes, см. 20260418190000.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin_request()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT false;
$$;

COMMENT ON FUNCTION public.is_admin_request() IS
  'Stub after drop of admin_users: не доверяет заголовку клиента. Админ — через service role.';

GRANT EXECUTE ON FUNCTION public.is_admin_request() TO anon, authenticated, service_role;
