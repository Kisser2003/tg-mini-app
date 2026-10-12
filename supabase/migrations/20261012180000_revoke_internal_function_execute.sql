-- Служебные функции (миграция данных и триггеры) не должны вызываться через REST API.
revoke execute on function public.migrate_table_user_ids_to_uuid(text,text,text), public.remigrate_all_user_data(), public.handle_new_auth_user(), public.sync_user_email() from public, anon, authenticated;
