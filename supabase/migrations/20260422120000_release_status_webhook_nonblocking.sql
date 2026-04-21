-- Смена статуса релиза на ready/failed не должна откатываться из-за сбоя pg_net / вебхука
-- (неверный URL, DNS, секрет, отсутствие расширения и т.д.).

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_release_status_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  webhook_url text := 'https://YOUR_PUBLIC_APP_DOMAIN/api/webhooks/release-status-change';
  webhook_secret text := '__REPLACE_WITH_SUPABASE_WEBHOOK_SECRET__';
  payload jsonb;
BEGIN
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

COMMENT ON FUNCTION public.notify_release_status_webhook() IS
  'После смены статуса на ready/failed: best-effort POST в Next.js; ошибки pg_net не откатывают UPDATE.';

COMMIT;
