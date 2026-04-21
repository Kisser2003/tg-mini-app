"use client";

import { useSyncExternalStore } from "react";
import { isTelegramClientShell } from "@/lib/telegram";

/**
 * Снимок для useSyncExternalStore: Mini App / WebView Telegram без гонки с initData.
 */
function getTelegramMiniAppSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return isTelegramClientShell();
}

function getTelegramMiniAppServerSnapshot(): boolean {
  return false;
}

/**
 * Пока Telegram WebApp не подмонтирован, один раз опрашиваем — иначе subscribe был пустой
 * и React никогда не узнавал, что initData/WebApp появились → ложный редирект на /login.
 */
function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  if (getTelegramMiniAppSnapshot()) return () => {};

  let cancelled = false;
  const id = window.setInterval(() => {
    if (cancelled) return;
    if (getTelegramMiniAppSnapshot()) {
      cancelled = true;
      window.clearInterval(id);
      onStoreChange();
    }
  }, 50);
  return () => {
    cancelled = true;
    window.clearInterval(id);
  };
}

/**
 * Hook: запущено ли приложение в Telegram Mini App (или WebView Telegram).
 */
export function useIsTelegramMiniApp(): boolean {
  return useSyncExternalStore(
    subscribe,
    getTelegramMiniAppSnapshot,
    getTelegramMiniAppServerSnapshot
  );
}

/**
 * Синхронная проверка на клиенте (подстраховка гидрации и useEffect).
 */
export function checkIsTelegramMiniApp(): boolean {
  return getTelegramMiniAppSnapshot();
}
