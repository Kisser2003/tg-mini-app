-- События воронки создания релиза. Запись только через service_role (API /api/analytics/event).
CREATE TABLE IF NOT EXISTS public.funnel_events (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  anon_id text NOT NULL,
  event text NOT NULL,
  step text,
  release_id uuid,
  props jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS funnel_events_created_at_idx ON public.funnel_events (created_at DESC);
CREATE INDEX IF NOT EXISTS funnel_events_event_idx ON public.funnel_events (event, created_at DESC);

ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.funnel_events FROM anon, authenticated;
