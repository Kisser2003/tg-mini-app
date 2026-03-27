-- RBAC: admin_users таблица — единый источник истины об администраторах.
-- Добавление/удаление администраторов — только через Supabase Dashboard (INSERT/DELETE в admin_users).
-- Заменяет hardcoded ID 810176982 в RLS-политиках таблиц releases, tracks, release_logs.

-- 1. Таблица администраторов
CREATE TABLE IF NOT EXISTS public.admin_users (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint     NOT NULL UNIQUE,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- service_role читает/пишет без политик; anon/authenticated не могут читать список
-- (это предотвращает утечку перечня администраторов через клиентский SDK).

COMMENT ON TABLE public.admin_users IS
  'Список администраторов по Telegram ID. Редактируется только через Supabase Dashboard с service_role.';

-- 2. Начальный сид — тот же ID, что был захардкожен.
--    ОБЯЗАТЕЛЬНО замените 810176982 на реальный ID перед первым supabase db push.
INSERT INTO public.admin_users (telegram_id, notes)
VALUES (810176982, 'Initial admin — update telegram_id before running migration in production')
ON CONFLICT (telegram_id) DO NOTHING;

-- 3. Вспомогательная функция: проверяет, является ли текущий запрос администраторским.
--    SECURITY DEFINER + STABLE: вызывается из каждой RLS-политики; обходит RLS на admin_users.
DROP FUNCTION IF EXISTS public.is_admin_request();

CREATE OR REPLACE FUNCTION public.is_admin_request()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE telegram_id = (
      nullif(
        trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
        ''
      )
    )::bigint
  );
$$;

COMMENT ON FUNCTION public.is_admin_request() IS
  'Возвращает true, если x-telegram-user-id из заголовка запроса совпадает с записью в admin_users.';

GRANT EXECUTE ON FUNCTION public.is_admin_request() TO anon, authenticated, service_role;

-- 4. Обновить политику на releases (удалить старую с hardcoded ID)
DROP POLICY IF EXISTS "Admin full access"              ON public.releases;
DROP POLICY IF EXISTS "Admin full access to ALL releases" ON public.releases;

CREATE POLICY "Admin full access to ALL releases" ON public.releases
  FOR ALL
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

-- 5. Обновить политику на tracks (удалить обе старые версии с hardcoded ID)
DROP POLICY IF EXISTS "Admin full access to ALL tracks" ON public.tracks;

CREATE POLICY "Admin full access to ALL tracks" ON public.tracks
  FOR ALL
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

-- 6. Обновить политику на release_logs
DROP POLICY IF EXISTS "Admin full access to ALL release_logs" ON public.release_logs;

CREATE POLICY "Admin full access to ALL release_logs" ON public.release_logs
  FOR ALL
  USING (is_admin_request())
  WITH CHECK (is_admin_request());
