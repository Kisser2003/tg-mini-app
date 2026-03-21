/**
 * Финансовая политика кошелька (ledger).
 * Интервал удержания должен совпадать с `interval '60 days'` в `get_user_balance` (Supabase).
 */

/** Дней с момента начисления (`transactions.created_at`), после которых сумма входит в «доступный» баланс. */
export const HOLDING_DAYS = 60 as const;

/** Минимум доступного баланса (₽) для запроса вывода. Всегда сверяйте с `available_balance`, не с `total_balance`. */
export const MIN_WITHDRAW_RUB = 1000 as const;
