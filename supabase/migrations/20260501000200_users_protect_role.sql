-- Защита users.role от самоповышения: users_update_own + GRANT UPDATE позволяют пользователю
-- менять свою строку, включая role, а role='admin' даёт доступ к админ-API (lib/admin-release-api-guard.ts).
-- Менять role могут только service_role / владелец БД (SQL Editor), но не anon/authenticated.
CREATE OR REPLACE FUNCTION public.users_protect_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND current_user IN ('anon', 'authenticated') THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_protect_role ON public.users;
CREATE TRIGGER users_protect_role
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_protect_role();

REVOKE EXECUTE ON FUNCTION public.users_protect_role() FROM PUBLIC, anon, authenticated;
