-- Колонка для публичной смарт-ссылки после выпуска (API /api/admin/publish-release-smart-link).
-- Ранее поле было только в types/database.types.ts без миграции.

BEGIN;

ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS smart_link text;

COMMENT ON COLUMN public.releases.smart_link IS
  'HTTPS URL смарт-страницы релиза (Band Link и др.); задаётся модерацией при выпуске.';

COMMIT;
