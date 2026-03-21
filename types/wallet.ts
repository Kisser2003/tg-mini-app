export type WalletTransactionType = "royalty" | "payout" | "bonus";

export type WalletTransactionStatus = "pending" | "completed" | "failed";

export type WalletTransactionRow = {
  id: string;
  user_id: number;
  amount: string;
  type: WalletTransactionType;
  status: WalletTransactionStatus;
  reference_id?: string | null;
  description: string | null;
  created_at: string;
};

export type WalletStatsResponse = {
  ok: true;
  /** Сумма всех завершённых транзакций (общий баланс по леджеру). */
  total_balance: number;
  /** Сумма завершённых транзакций старше периода удержания — доступна к выводу. */
  available_balance: number;
  pending_withdrawals: number;
  recent_transactions: WalletTransactionRow[];
};
