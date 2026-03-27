"use client";

import useSWR from "swr";
import { fetchWalletStats } from "@/lib/fetch-wallet-stats";
import { useTelegramInitData } from "@/lib/telegram-init-data-context";
import type { WalletStatsResponse } from "@/types/wallet";

/** SWR key segment — fetch runs after `TelegramInitDataProvider` has read WebApp (avoids racing init). */
const WALLET_STATS_KEY = "wallet-stats" as const;

/** SWR wrapper for `/api/wallet/stats` (Telegram `initData` via `fetchWalletStats`). */
export function useWalletStats() {
  const { initData, ready } = useTelegramInitData();

  const swrKey = ready ? ([WALLET_STATS_KEY, initData ?? ""] as const) : null;

  return useSWR<WalletStatsResponse>(
    swrKey,
    ([, data]: readonly [typeof WALLET_STATS_KEY, string]) => fetchWalletStats(data),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000
    }
  );
}

export { WALLET_STATS_KEY };
