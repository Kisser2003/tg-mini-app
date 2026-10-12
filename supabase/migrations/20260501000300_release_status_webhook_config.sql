-- Вебхук статусов: URL и секрет больше не захардкожены в функции, а читаются из private.app_config
-- (схема не доступна через PostgREST). Секрет задаётся один раз сервером:
--   POST /rest/v1/rpc/set_app_config {"p_key":"release_status_webhook_secret","p_value":"<SUPABASE_WEBHOOK_SECRET>"}
-- с service_role ключом. Значение секрета в репозиторий не коммитится.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.app_config FROM PUBLIC, anon, authenticated;

INSERT INTO private.app_config (key, value)
VALUES ('release_status_webhook_url', 'https://tg-mini-app-orcin.vercel.app/api/webhooks/release-status-change')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

CREATE OR REPLACE FUNCTION public.set_app_config(p_key text, p_value text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public
AS $$
  INSERT INTO private.app_config (key, value) VALUES (p_key, p_value)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
$$;
REVOKE EXECUTE ON FUNCTION public.set_app_config(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_app_config(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_release_status_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  webhook_url text;
  webhook_secret text;
  payload jsonb;
BEGIN
  SELECT value INTO webhook_url FROM private.app_config WHERE key = 'release_status_webhook_url';
  SELECT value INTO webhook_secret FROM private.app_config WHERE key = 'release_status_webhook_secret';

  IF webhook_url IS NULL OR webhook_secret IS NULL THEN
    RAISE WARNING '[notify_release_status_webhook] webhook url/secret not configured in private.app_config';
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'id', NEW.id,
    'user_id', NEW.user_id,
    'old_status', OLD.status,
    'new_status', NEW.status,
    'error_message', NEW.error_message
  );

  BEGIN
    PERFORM net.http_post(
      url := webhook_url,
      body := payload,
      params := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-supabase-webhook-secret', webhook_secret
      ),
      timeout_milliseconds := 10000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_release_status_webhook] release %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_release_status_webhook() FROM PUBLIC, anon, authenticated;
