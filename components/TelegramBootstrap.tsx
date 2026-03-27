"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getExpectedAdminTelegramId } from "@/lib/admin";
import {
  acquireTelegramClosingConfirmation,
  getTelegramStartParam,
  getTelegramUserId,
  initTelegramWebApp,
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
      navigator.serviceWorker
        .register("/sw-audio.js")
        .then(() => {})
        .catch((err) => {
          console.error("[SW-AUDIO] registration failed", err);
        });
    }

    const startParam = getTelegramStartParam();
    const userId = getTelegramUserId();
    let adminId: number | null = null;
    try {
      adminId = getExpectedAdminTelegramId();
    } catch {
      // ADMIN_TELEGRAM_ID env var not set; deep-link redirect disabled
    }
    if (startParam === "admin" && adminId !== null && userId === adminId && pathname !== "/admin") {
      router.replace("/admin");
    }
  }, [pathname, router]);

  return null;
}
