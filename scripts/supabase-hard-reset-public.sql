-- =============================================================================
-- Жёсткий сброс данных в схеме public (структура таблиц сохраняется)
-- =============================================================================
-- Запуск: Supabase Dashboard → SQL Editor → вставить и выполнить
--         или: psql / supabase db execute (с осторожностью на проде)
--
-- Включает все таблицы из types/database.types.ts (public) для этого проекта.
-- Опциональные таблицы (если есть в вашей БД после ручных миграций) — блоки внизу.
--
-- ВАЖНО: перед этим очистите Storage (scripts/empty-storage-buckets.mjs) при необходимости.
-- После TRUNCATE очистите auth (отдельно — см. scripts/delete-all-auth-users.mjs или раздел в README скрипта).
-- =============================================================================

BEGIN;

-- Порядок: сначала зависимые от releases, затем releases, затем users и прочее.
-- CASCADE снимает строки в дочерних таблицах при конфликте FK.
TRUNCATE TABLE
  public.tracks,
  public.release_logs,
  public.ai_moderation_logs,
  public.releases,
  public.user_preferences,
  public.error_logs,
  public.users
RESTART IDENTITY CASCADE;

COMMIT;

-- -----------------------------------------------------------------------------
-- Опционально: только если таблица существует (выполнять отдельными блоками)
-- -----------------------------------------------------------------------------

-- Таблица feedback (миграция 20260324120000_feedback.sql) — может отсутствовать в актуальных типах
-- BEGIN;
-- TRUNCATE TABLE public.feedback RESTART IDENTITY CASCADE;
-- COMMIT;

-- Таблица admin_users (RBAC) — в части деплоев удалена миграцией 20260417180000_remove_wallet_and_unused_tables.sql
-- BEGIN;
-- TRUNCATE TABLE public.admin_users RESTART IDENTITY CASCADE;
-- COMMIT;
