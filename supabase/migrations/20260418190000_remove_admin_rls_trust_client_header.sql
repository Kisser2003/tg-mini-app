-- ============================================================================
-- SECURITY: убрать admin-доступ через RLS по заголовку x-telegram-user-id
-- ============================================================================
-- Раньше политики "Admin full access to ALL *" использовали is_admin_request(),
-- который доверял client-supplied заголовку PostgREST. Любой клиент с anon key мог
-- подставить telegram_id администратора и читать/писать все релизы.
--
-- Админка после этого миграции должна опираться только на API с service role
-- (withTelegramAuth + createSupabaseAdmin), см. /api/admin/moderation-queue и др.
--
-- Функция public.is_admin_request() оставлена для возможных будущих RPC; в RLS не используется.

DROP POLICY IF EXISTS "Admin full access to ALL releases" ON public.releases;
DROP POLICY IF EXISTS "Admin full access to ALL tracks" ON public.tracks;
DROP POLICY IF EXISTS "Admin full access to ALL release_logs" ON public.release_logs;
