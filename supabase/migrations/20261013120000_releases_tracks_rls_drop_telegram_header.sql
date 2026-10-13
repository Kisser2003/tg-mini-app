-- Security: RLS на releases / tracks / release_logs больше не доверяет заголовку x-telegram-user-id.
--
-- Раньше политики сравнивали user_id / telegram_id с public.request_telegram_user_id(), то есть со
-- значением заголовка, которое клиент ставит сам. С anon-ключом любой мог подставить чужой Telegram id
-- и читать / менять / удалять чужие релизы и треки.
--
-- Mini App теперь ходит в эти таблицы только через API владельца (/api/releases/*: проверка initData или
-- cookie-сессии + service role, который RLS не затрагивает). Через anon/authenticated остаётся доступ
-- только по JWT (user_uuid = auth.uid()) и для is_admin_request().
--
-- ПОРЯДОК ВЫКАТА: сначала задеплоить код с маршрутами /api/releases/*, потом применять эту миграцию.
-- Иначе старый клиент (прямые запросы с заголовком) перестанет видеть и сохранять черновики.
--
-- Данные не меняются: только политики. request_telegram_user_id() не удаляется — её ещё используют
-- политики users / user_preferences (отдельная задача).

BEGIN;

ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_logs ENABLE ROW LEVEL SECURITY;

-- Снимаем все существующие политики (в т.ч. возможные ручные из дашборда со сравнением заголовка).
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('releases', 'tracks', 'release_logs')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- releases
-- ---------------------------------------------------------------------------
CREATE POLICY releases_select_own ON public.releases
  FOR SELECT
  USING (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
  );

CREATE POLICY releases_insert_own ON public.releases
  FOR INSERT
  WITH CHECK (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
  );

CREATE POLICY releases_update_own ON public.releases
  FOR UPDATE
  USING (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
  )
  WITH CHECK (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
  );

CREATE POLICY releases_delete_own ON public.releases
  FOR DELETE
  USING (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- tracks
-- ---------------------------------------------------------------------------
CREATE POLICY tracks_select_own ON public.tracks
  FOR SELECT
  USING (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
  );

CREATE POLICY tracks_insert_own ON public.tracks
  FOR INSERT
  WITH CHECK (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
  );

CREATE POLICY tracks_update_own ON public.tracks
  FOR UPDATE
  USING (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
  )
  WITH CHECK (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
  );

CREATE POLICY tracks_delete_own ON public.tracks
  FOR DELETE
  USING (
    public.is_admin_request()
    OR user_uuid = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- release_logs: только чтение своих (по JWT) или админом; запись — service role / RPC.
-- ---------------------------------------------------------------------------
CREATE POLICY release_logs_select_own ON public.release_logs
  FOR SELECT
  USING (
    public.is_admin_request()
    OR EXISTS (
      SELECT 1
      FROM public.releases r
      WHERE r.id = release_logs.release_id
        AND r.user_uuid = (select auth.uid())
    )
  );

COMMIT;
