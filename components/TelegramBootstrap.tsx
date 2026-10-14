"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { mutate } from "swr";
import { getAdminTelegramIdForUi, telegramIdsEqual } from "@/lib/admin";
import {
  acquireTelegramClosingConfirmation,
  getTelegramStartParam,
  getTelegramUserId,
  initTelegramWebApp,
  isTelegramClientShell,
  releaseTelegramClosingConfirmation
} from "@/lib/telegram";
import { releaseApiRequest } from "@/lib/api/release-client";
import { REFEREE_DISCOUNT_RUB, formatRub, parseReferralStartParam } from "@/lib/referral";
import { REFERRAL_SWR_KEY } from "@/lib/hooks/useReferral";

const REFERRAL_ATTEMPT_KEY = "omf:referral-attempted";

/** Открыли по ссылке друга (`startapp=ref_…`) — один раз за запуск просим сервер привязать приглашение. */
function attributeReferralOnce(): void {
  if (!parseReferralStartParam(getTelegramStartParam())) return;
  try {
    if (sessionStorage.getItem(REFERRAL_ATTEMPT_KEY)) return;
    sessionStorage.setItem(REFERRAL_ATTEMPT_KEY, "1");
  } catch {
    /* без sessionStorage сервер всё равно идемпотентен */
  }
  void releaseApiRequest<{ ok: boolean; result: string }>("/api/referral/attribute", { method: "POST", body: {} })
    .then((res) => {
      if (res.result !== "attributed") return;
      toast.success(`Тебя пригласил друг — скидка ${formatRub(REFEREE_DISCOUNT_RUB)} на первый релиз`);
      void mutate(REFERRAL_SWR_KEY);
    })
    .catch(() => {});
}

export function TelegramBootstrap() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    initTelegramWebApp();
    acquireTelegramClosingConfirmation();
    attributeReferralOnce();
    return () => releaseTelegramClosingConfirmation();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      if (!isTelegramClientShell()) {
        void navigator.serviceWorker
          .getRegistrations()
          .then((regs) => {
            for (const reg of regs) {
              void reg.unregister();
            }
          })
          .catch(() => {});
      } else {
        navigator.serviceWorker
          .register("/sw-audio.js")
          .then(() => {})
          .catch((err) => {
            console.error("[SW-AUDIO] registration failed", err);
          });
      }
    }

    const startParam = getTelegramStartParam();
    const userId = getTelegramUserId();
    const adminId = getAdminTelegramIdForUi();
    if (
      startParam === "admin" &&
      adminId !== null &&
      userId !== null &&
      telegramIdsEqual(userId, adminId) &&
      pathname === "/"
    ) {
      router.replace("/admin");
    }
  }, [pathname, router]);

  return null;
}
