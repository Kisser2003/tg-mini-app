-- Каноническая finalize_release для приложения (POST /api/releases/finalize-submit, submitRelease).
-- В проде могла оказаться кастомная версия с RETURNS jsonb — PostgREST тогда не отдаёт строки releases.
-- DROP + CREATE гарантирует смену типа возврата (CREATE OR REPLACE не меняет RETURNS).

DROP FUNCTION IF EXISTS public.finalize_release(uuid, uuid);

CREATE OR REPLACE FUNCTION public.finalize_release(
  p_release_id uuid,
  p_client_request_id uuid
)
RETURNS SETOF public.releases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.releases;
BEGIN
  SELECT *
  INTO STRICT r
  FROM public.releases
  WHERE id = p_release_id
  FOR UPDATE;

  IF r.client_request_id IS DISTINCT FROM p_client_request_id THEN
    RAISE EXCEPTION 'client_request_id_mismatch';
  END IF;

  IF r.status IN ('processing', 'ready') THEN
    RETURN QUERY
    SELECT *
    FROM public.releases
    WHERE id = p_release_id;
    RETURN;
  END IF;

  IF r.status NOT IN ('draft', 'pending') THEN
    RAISE EXCEPTION 'invalid_status_for_finalize: %', r.status;
  END IF;

  UPDATE public.releases
  SET
    status = 'processing',
    error_message = NULL
  WHERE
    id = p_release_id
    AND client_request_id = p_client_request_id
    AND status IN ('draft', 'pending')
  RETURNING * INTO r;

  IF FOUND THEN
    INSERT INTO public.release_logs (release_id, stage, status, error_message)
    VALUES (p_release_id, 'finalize', 'processing', NULL);

    RETURN QUERY
    SELECT *
    FROM public.releases
    WHERE id = p_release_id;
    RETURN;
  END IF;

  SELECT *
  INTO r
  FROM public.releases
  WHERE id = p_release_id;

  IF r.status IN ('processing', 'ready') THEN
    RETURN QUERY
    SELECT *
    FROM public.releases
    WHERE id = p_release_id;
    RETURN;
  END IF;

  RAISE EXCEPTION 'finalize_release_concurrent_or_invalid_state';
END;
$$;

COMMENT ON FUNCTION public.finalize_release(uuid, uuid) IS
  'Переводит релиз из draft/pending в processing и пишет лог finalize; идемпотентен для processing/ready. Возвращает SETOF releases.';

GRANT EXECUTE ON FUNCTION public.finalize_release(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.finalize_release(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_release(uuid, uuid) TO service_role;
