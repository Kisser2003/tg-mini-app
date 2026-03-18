-- Replace <project-ref> and <service-role-jwt> before running.
-- Example function URL:
-- https://<project-ref>.functions.supabase.co/notify-admin

drop trigger if exists "releases_notify_admin_insert" on "public"."releases";

create trigger "releases_notify_admin_insert"
after insert on "public"."releases"
for each row
execute function "supabase_functions"."http_request"(
  'https://<project-ref>.functions.supabase.co/notify-admin',
  'POST',
  '{"Content-Type":"application/json","Authorization":"Bearer <service-role-jwt>"}'::jsonb,
  '{}'::jsonb,
  '5000'
);
