-- Запретить завершённые транзакции с нулевой суммой (пустые проводки).
-- Идемпотентно: constraint только если ещё нет.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transactions_completed_nonzero_amount_chk'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_completed_nonzero_amount_chk
      CHECK (
        status IS DISTINCT FROM 'completed'::public.wallet_transaction_status
        OR amount <> 0
      );
  END IF;
END
$$;

COMMENT ON CONSTRAINT transactions_completed_nonzero_amount_chk ON public.transactions IS
  'При status=completed сумма amount не может быть 0.';

-- Синхронизация с эталоном: баланс всегда число (в т.ч. при отсутствии строк).
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
