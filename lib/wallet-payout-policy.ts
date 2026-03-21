/**
 * Финансовая политика кошелька (ledger).
 * Интервал удержания должен совпадать с `interval '60 days'` в `get_user_balance` (Supabase).
 */

/** Дней с момента начисления (`transactions.created_at`), после которых сумма входит в «доступный» баланс. */
export const HOLDING_DAYS = 60 as const;

/** Минимум доступного баланса (₽) для запроса вывода. Всегда сверяйте с `available_balance`, не с `total_balance`. */
export const MIN_WITHDRAW_RUB = 1000 as const;

/** Склонение «день» для фразы о периоде удержания (копирайт в UI). */
export function ruDaysWord(n: number): string {
  const n100 = n % 100;
  if (n100 >= 11 && n100 <= 14) return "дней";
  const n10 = n % 10;
  if (n10 === 1) return "день";
  if (n10 >= 2 && n10 <= 4) return "дня";
  return "дней";
}

/** Короткая фраза для экрана кошелька (без технических терминов). */
export function holdingPeriodUserMessage(): string {
  return `Средства станут доступны через ${HOLDING_DAYS} ${ruDaysWord(HOLDING_DAYS)} после начисления.`;
}
