"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_TELEGRAM_ID } from "@/lib/admin";
import { getTelegramStartParam, getTelegramUserId, initTelegramWebApp } from "@/lib/telegram";

export function TelegramBootstrap() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    initTelegramWebApp();

    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw-audio.js")
        .then((reg) => {
          if (process.env.NODE_ENV === "development") {
            console.log("[SW-AUDIO] registered", reg.scope);
          }
        })
        .catch((err) => {
          console.error("[SW-AUDIO] registration failed", err);
        });
    }

    const startParam = getTelegramStartParam();
    const userId = getTelegramUserId();
    if (startParam === "admin" && userId === ADMIN_TELEGRAM_ID && pathname !== "/admin") {
      router.replace("/admin");
    }
  }, [pathname, router]);

  return null;
}
