-- Админ (Telegram ID 810176982): полный доступ к строкам releases по заголовку x-telegram-user-id.
-- Выполните в Supabase SQL Editor или через supabase db push.
-- Политика дополняет существующие (OR); не отключает RLS.

DROP POLICY IF EXISTS "Admin full access" ON public.releases;
DROP POLICY IF EXISTS "Admin full access to ALL releases" ON public.releases;

CREATE POLICY "Admin full access to ALL releases" ON public.releases
  FOR ALL
  USING (
    coalesce(
      current_setting('request.headers', true)::jsonb->>'x-telegram-user-id',
      ''
    )
    = '810176982'
  )
  WITH CHECK (
    coalesce(
      current_setting('request.headers', true)::jsonb->>'x-telegram-user-id',
      ''
    )
    = '810176982'
  );
