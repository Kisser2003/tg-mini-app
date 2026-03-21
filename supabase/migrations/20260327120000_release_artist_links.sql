-- Профили артиста на площадках (маппинг для дистрибуции)
alter table public.releases
  add column if not exists has_existing_profiles boolean not null default false;

alter table public.releases
  add column if not exists artist_links jsonb not null default '{}'::jsonb;

comment on column public.releases.has_existing_profiles is 'Пользователь указал, что профили на DSP уже есть';
comment on column public.releases.artist_links is 'Ссылки на артиста: spotify, apple, yandex, vk (JSON)';
