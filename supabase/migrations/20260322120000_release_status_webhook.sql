-- Release status change → Next.js webhook → Telegram (pg_net).
--
-- Before running (Dashboard → SQL Editor or supabase db push):
-- 1. Enable extension "pg_net" if not already (Dashboard → Database → Extensions).
-- 2. Replace placeholders below:
--    - YOUR_PUBLIC_APP_DOMAIN — production URL without trailing slash, e.g. https://my-app.vercel.app
--    - __REPLACE_WITH_SUPABASE_WEBHOOK_SECRET__ — same value as SUPABASE_WEBHOOK_SECRET on your Next.js host.
--
-- Do not commit the real secret into version control; run a one-off SQL in prod or use Supabase Vault.

CREATE EXTENSION IF NOT EXISTS pg_net;

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

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_release_status_webhook() IS
  'After status → ready/failed: POST JSON to Next.js webhook (see trigger WHEN clause).';

DROP TRIGGER IF EXISTS on_release_status_update ON public.releases;

CREATE TRIGGER on_release_status_update
  AFTER UPDATE OF status ON public.releases
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    AND NEW.status IN ('ready', 'failed')
  )
  EXECUTE FUNCTION public.notify_release_status_webhook();
