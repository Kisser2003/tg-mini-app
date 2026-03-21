export type AdminStatsResponse = {
  ok: true;
  /** Релизы в статусе processing */
  pending_queue: number;
  /** Релизы со статусом ready, созданные с начала текущих суток (UTC) */
  ready_today: number;
  /** Сумма amount по всем транзакциям со статусом pending */
  pending_hold_sum: number;
};
