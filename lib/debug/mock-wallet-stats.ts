import type { WalletStatsResponse } from "@/types/wallet";

/**
 * Localhost UI preview — mirrors requested demo fields mapped onto {@link WalletStatsResponse}:
 * - `total_balance` ← total_earned
 * - `pending_withdrawals` ← payouts_in_progress
 * - `royalty` ← income rows; `payout` ← withdrawal (negative amount)
 *
 * Toggle via `NEXT_PUBLIC_DEBUG_MOCK_WALLET=1` in `.env.local`.
 */
export const mockWalletStats: WalletStatsResponse = {
  ok: true,
  available_balance: 12500.5,
  total_balance: 45000,
  pending_withdrawals: 0,
  recent_transactions: [
    {
      id: "1",
      user_id: 0,
      amount: "5400",
      type: "royalty",
      status: "completed",
      description: "Streaming Royalty (Spotify)",
      created_at: "2026-03-20T12:00:00.000Z",
      reference_id: null
    },
    {
      id: "2",
      user_id: 0,
      amount: "1200",
      type: "royalty",
      status: "completed",
      description: "Streaming Royalty (Apple Music)",
      created_at: "2026-03-18T12:00:00.000Z",
      reference_id: null
    },
    {
      id: "3",
      user_id: 0,
      amount: "-10000",
      type: "payout",
      status: "pending",
      description: "Withdrawal to Card",
      created_at: "2026-03-25T12:00:00.000Z",
      reference_id: null
    }
  ]
};
