-- Audit trail for AI metadata pre-check (submit-precheck / finalize-submit).
-- Written only from the Next.js API using the service role.

create table if not exists public.ai_moderation_logs (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases (id) on delete cascade,
  user_id bigint,
  status text not null check (status in ('approved', 'flagged')),
  flagged_reasons jsonb not null default '[]'::jsonb,
  confidence_score double precision,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists ai_moderation_logs_release_id_idx
  on public.ai_moderation_logs (release_id desc);

create index if not exists ai_moderation_logs_created_at_idx
  on public.ai_moderation_logs (created_at desc);

comment on table public.ai_moderation_logs is
  'Structured AI metadata QA results before release moves to processing.';

alter table public.ai_moderation_logs enable row level security;
