"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAdminTelegramIdForUi, telegramIdsEqual } from "@/lib/admin";
import {
  acquireTelegramClosingConfirmation,
  getTelegramStartParam,
  getTelegramUserId,
  initTelegramWebApp,
  isTelegramClientShell,
  releaseTelegramClosingConfirmation
} from "@/lib/telegram";

export function TelegramBootstrap() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    initTelegramWebApp();
    acquireTelegramClosingConfirmation();
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
