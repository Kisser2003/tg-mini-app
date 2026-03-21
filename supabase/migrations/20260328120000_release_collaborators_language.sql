-- Участники релиза (фиты, продюсер) + язык исполнения
alter table public.releases
  add column if not exists performance_language text;

alter table public.releases
  add column if not exists collaborators jsonb not null default '[]'::jsonb;

comment on column public.releases.performance_language is 'Язык исполнения (RU, EN, Instrumental, …)';
comment on column public.releases.collaborators is 'Участники: name, role, spotifyUrl?, appleUrl? (JSON array)';
