alter table public.error_logs add column if not exists screen_name text;

comment on column public.error_logs.screen_name is 'Экран / контекст UI (например CreateMetadata_hydrate).';
