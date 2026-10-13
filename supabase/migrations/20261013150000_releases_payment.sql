-- Оплата релиза: студия (Денис) отвечает кнопкой в боте «Оплатил / Не оплатил / Не мой клиент»,
-- админ может поправить статус в админке. История изменений — release_logs (stage = 'payment').
-- terms_accepted_at — артист отметил условия (выпуск платный, без возвратов) перед отправкой.
ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS payment_status text
    CHECK (payment_status IS NULL OR payment_status IN ('awaiting', 'paid', 'unpaid', 'not_client')),
  ADD COLUMN IF NOT EXISTS payment_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_updated_by text
    CHECK (payment_updated_by IS NULL OR payment_updated_by IN ('studio', 'admin')),
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

COMMENT ON COLUMN public.releases.payment_status IS
  'awaiting — спросили студию; paid / unpaid / not_client — ответ студии или правка админа. NULL — не спрашивали.';
COMMENT ON COLUMN public.releases.payment_updated_by IS 'studio — кнопка в боте, admin — админка.';
COMMENT ON COLUMN public.releases.terms_accepted_at IS 'Когда артист принял условия (платный выпуск, без возвратов).';

-- Артист не может сам отметить оплату: владельцу разрешён UPDATE своей строки (releases_update_own),
-- поэтому для anon/authenticated колонки оплаты и условий не меняются. Пишет только service role (API).
CREATE OR REPLACE FUNCTION public.releases_protect_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.payment_status := NULL;
      NEW.payment_updated_at := NULL;
      NEW.payment_updated_by := NULL;
      NEW.terms_accepted_at := NULL;
    ELSE
      NEW.payment_status := OLD.payment_status;
      NEW.payment_updated_at := OLD.payment_updated_at;
      NEW.payment_updated_by := OLD.payment_updated_by;
      NEW.terms_accepted_at := OLD.terms_accepted_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS releases_protect_payment ON public.releases;
CREATE TRIGGER releases_protect_payment
  BEFORE INSERT OR UPDATE ON public.releases
  FOR EACH ROW EXECUTE FUNCTION public.releases_protect_payment();

REVOKE EXECUTE ON FUNCTION public.releases_protect_payment() FROM PUBLIC, anon, authenticated;
