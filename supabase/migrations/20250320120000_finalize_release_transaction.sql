-- Атомарная финализация релиза: переход draft -> processing и запись в release_logs в одной транзакции.
-- Идемпотентность: при повторном вызове, если статус уже processing или ready, возвращается текущая строка без ошибки.

DROP FUNCTION IF EXISTS public.finalize_release(uuid);
-- Смена RETURNS (например jsonb → SETOF) через CREATE OR REPLACE невозможна — сброс перед CREATE.
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

  IF r.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'invalid_status_for_finalize: %', r.status;
  END IF;

  UPDATE public.releases
  SET
    status = 'processing',
    error_message = NULL
  WHERE
    id = p_release_id
    AND client_request_id = p_client_request_id
    AND status = 'draft'
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
  'Переводит релиз из draft в processing и пишет лог finalize; идемпотентен для processing/ready.';

GRANT EXECUTE ON FUNCTION public.finalize_release(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.finalize_release(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_release(uuid, uuid) TO service_role;
