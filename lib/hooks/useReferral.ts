"use client";

import useSWR from "swr";
import { releaseApiRequest } from "@/lib/api/release-client";
import { useIsTelegramMiniApp } from "@/lib/hooks/useIsTelegramMiniApp";
import type { ReferralSummary } from "@/lib/referral";

export const REFERRAL_SWR_KEY = "referral-me";

async function fetchReferral(): Promise<ReferralSummary> {
  const json = await releaseApiRequest<{ ok: boolean; referral: ReferralSummary }>("/api/referral/me");
  return json.referral;
}

/** Код, ссылка и счётчики приглашений. Только в Telegram: программа привязана к telegram_id. */
export function useReferral() {
  const isTelegram = useIsTelegramMiniApp();
  return useSWR(isTelegram ? REFERRAL_SWR_KEY : null, fetchReferral, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000
  });
}
