-- Прямой UPDATE строки releases с клиента (anon + заголовок x-telegram-user-id).
-- RPC finalize_release — SECURITY DEFINER; этот политика страхует fallback updateRelease / ensureReleaseProcessing.

DROP POLICY IF EXISTS "Users own releases update" ON public.releases;

CREATE POLICY "Users own releases update" ON public.releases
  FOR UPDATE
  USING (
    user_id::bigint = (
      nullif(
        trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
        ''
      )
    )::bigint
  )
  WITH CHECK (
    user_id::bigint = (
      nullif(
        trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
        ''
      )
    )::bigint
  );

COMMENT ON POLICY "Users own releases update" ON public.releases IS
  'Владелец может обновлять строку релиза по совпадению user_id с заголовком x-telegram-user-id.';
