-- Клиентские / UI ошибки (через API с service role). RLS: нет политик для anon — пишет только сервер.
create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id bigint null,
  route text null,
  error_message text not null,
  stack_trace text null,
  component_stack text null,
  extra jsonb null
);

create index if not exists error_logs_created_at_idx on public.error_logs (created_at desc);

comment on table public.error_logs is 'Логи ошибок с клиента (Next API + service role).';
