-- Holding period: «доступный к выводу» баланс = completed-транзакции старше HOLDING_DAYS.
-- Заменяем одноаргументную get_user_balance на (text, boolean default false).

DROP FUNCTION IF EXISTS public.get_user_balance(text);

CREATE OR REPLACE FUNCTION public.get_user_balance(
  p_user_id text,
  p_only_available boolean DEFAULT false
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(sum(amount), 0)::numeric
  FROM public.transactions
  WHERE user_id = p_user_id::bigint
    AND status = 'completed'::public.wallet_transaction_status
    AND (
      NOT p_only_available
      OR created_at <= (now() - interval '60 days')
    );
$$;

COMMENT ON FUNCTION public.get_user_balance(text, boolean) IS
  'Сумма amount (completed) для user_id. При p_only_available=true — только проводки не новее 60 дней с момента created_at (доступно к выводу). Только service_role.';

REVOKE ALL ON FUNCTION public.get_user_balance(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_balance(text, boolean) TO service_role;
