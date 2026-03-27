-- Таблица release_logs: аудит-лог изменений статуса релиза.
-- Упоминается в finalize_release RPC (20250320120000, 20260325120000) и в repositories/releases.repo.ts.
-- RLS: пользователи читают только свои строки; запись только через SECURITY DEFINER функции и service_role.

CREATE TABLE IF NOT EXISTS public.release_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.releases (id) ON DELETE CASCADE,
  stage text NOT NULL,
  status text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS release_logs_release_id_idx ON public.release_logs (release_id);
CREATE INDEX IF NOT EXISTS release_logs_created_at_idx ON public.release_logs (created_at DESC);

COMMENT ON TABLE public.release_logs IS
  'Аудит-лог этапов обработки релиза: create, upload, finalize, status, error. Запись через SECURITY DEFINER / service_role.';

ALTER TABLE public.release_logs ENABLE ROW LEVEL SECURITY;

-- Пользователь читает логи своих релизов (через JOIN с releases).
DROP POLICY IF EXISTS "release_logs_select_own" ON public.release_logs;
CREATE POLICY "release_logs_select_own" ON public.release_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.releases r
      WHERE r.id = release_logs.release_id
        AND r.user_id = (
          nullif(
            trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
            ''
          )
        )::bigint
    )
  );

-- Запись только через service_role (RPC finalize_release — SECURITY DEFINER, обходит RLS).
-- Нет политик INSERT для anon/authenticated — защита от прямой записи клиентом.

DROP POLICY IF EXISTS "Admin full access to ALL release_logs" ON public.release_logs;
CREATE POLICY "Admin full access to ALL release_logs" ON public.release_logs
  FOR ALL
  USING (
    coalesce(
      current_setting('request.headers', true)::jsonb->>'x-telegram-user-id',
      ''
    ) = (SELECT value FROM pg_settings WHERE name = 'app.admin_telegram_id' LIMIT 1)
    OR
    coalesce(
      current_setting('request.headers', true)::jsonb->>'x-telegram-user-id',
      ''
    ) = '810176982'
  )
  WITH CHECK (
    coalesce(
      current_setting('request.headers', true)::jsonb->>'x-telegram-user-id',
      ''
    ) = '810176982'
  );

GRANT SELECT ON public.release_logs TO anon, authenticated;
