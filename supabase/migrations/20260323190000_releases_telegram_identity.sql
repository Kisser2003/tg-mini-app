-- Идентичность Telegram для RLS/списков «Мои релизы» (совпадение с x-telegram-user-id).
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS telegram_id bigint;
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS telegram_username text;

UPDATE public.releases
SET telegram_id = user_id
WHERE telegram_id IS NULL AND user_id IS NOT NULL;

COMMENT ON COLUMN public.releases.telegram_id IS 'Telegram user id (дублирует смысл user_id; для политик и фильтров).';
COMMENT ON COLUMN public.releases.telegram_username IS '@username без @, из WebApp initDataUnsafe.user';
