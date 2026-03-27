-- Пользовательские настройки: уведомления + реквизиты вывода.
-- Запись напрямую через анонимный клиент с RLS (x-telegram-user-id); чтение тоже RLS.

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id            bigint      PRIMARY KEY,
  push_notifications boolean     NOT NULL DEFAULT true,
  payout_method      text,
  payout_details     jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_preferences IS
  'Настройки пользователя Mini App: уведомления и реквизиты для вывода.';
COMMENT ON COLUMN public.user_preferences.payout_method IS
  'Метод вывода: bank_card | crypto | paypal';
COMMENT ON COLUMN public.user_preferences.payout_details IS
  'Детали реквизитов (свободная структура JSON для каждого метода).';

-- Автообновление updated_at при изменении строки
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Владелец: полный доступ к своей строке
DROP POLICY IF EXISTS "own_prefs" ON public.user_preferences;
CREATE POLICY "own_prefs" ON public.user_preferences
  FOR ALL
  USING (
    user_id = (
      nullif(
        trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
        ''
      )
    )::bigint
  )
  WITH CHECK (
    user_id = (
      nullif(
        trim(coalesce(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', '')),
        ''
      )
    )::bigint
  );

GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO anon, authenticated;
