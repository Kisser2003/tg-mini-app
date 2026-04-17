-- Ledger: payout_accounts + transactions, RLS (чтение своих строк по x-telegram-user-id), запись только service_role.
-- Идемпотентно: IF NOT EXISTS / DO $$ EXCEPTION для ENUM.

-- ENUM типы транзакций
DO $$
BEGIN
  CREATE TYPE public.wallet_transaction_type AS ENUM ('royalty', 'payout', 'bonus');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.wallet_transaction_status AS ENUM ('pending', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Реквизиты вывода 1:1 с пользователем (Telegram user id)
CREATE TABLE IF NOT EXISTS public.payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL UNIQUE,
  payout_method text NOT NULL,
  account_masked text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payout_accounts IS 'Реквизиты вывода; user_id = Telegram id.';

-- Журнал транзакций: amount со знаком (начисления >0, списания <0)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL,
  amount numeric(18, 2) NOT NULL,
  type public.wallet_transaction_type NOT NULL,
  status public.wallet_transaction_status NOT NULL,
  reference_id uuid,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.transactions IS 'Ledger: баланс = сумма amount при status=completed. Запись только через service_role / Edge.';

CREATE INDEX IF NOT EXISTS transactions_user_id_created_at_idx
  ON public.transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON public.transactions (user_id);

CREATE INDEX IF NOT EXISTS transactions_reference_id_idx ON public.transactions (reference_id)
  WHERE reference_id IS NOT NULL;

-- RLS
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payout_accounts_select_own" ON public.payout_accounts;
CREATE POLICY "payout_accounts_select_own" ON public.payout_accounts
  FOR SELECT
  USING (
    user_id::text = coalesce(
      nullif(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', ''),
      ''
    )
  );

DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT
  USING (
    user_id::text = coalesce(
      nullif(current_setting('request.headers', true)::jsonb->>'x-telegram-user-id', ''),
      ''
    )
  );

-- INSERT/UPDATE/DELETE для anon/authenticated без политик = запрещено; service_role обходит RLS.

-- Баланс по завершённым операциям (вызов только с сервера с service_role)
CREATE OR REPLACE FUNCTION public.get_user_balance(p_user_id text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(sum(amount), 0)::numeric
  FROM public.transactions
  WHERE user_id = p_user_id::bigint
    AND status = 'completed'::public.wallet_transaction_status;
$$;

COMMENT ON FUNCTION public.get_user_balance(text) IS 'Сумма amount (completed) для user_id. Только service_role.';

REVOKE ALL ON FUNCTION public.get_user_balance(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_balance(text) TO service_role;

GRANT SELECT ON public.transactions TO anon, authenticated;
GRANT SELECT ON public.payout_accounts TO anon, authenticated;
