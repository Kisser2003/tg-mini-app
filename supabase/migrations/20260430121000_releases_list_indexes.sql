-- Speed up initial "my releases" list fetches with ORDER BY created_at.
create index if not exists idx_releases_user_id_created_at_desc
  on public.releases (user_id, created_at desc);

create index if not exists idx_releases_telegram_id_created_at_desc
  on public.releases (telegram_id, created_at desc);

create index if not exists idx_releases_user_uuid_created_at_desc
  on public.releases (user_uuid, created_at desc);
