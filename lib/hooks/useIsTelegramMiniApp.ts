"use client";

import { useSyncExternalStore } from "react";

/**
 * Синхронное чтение `initData` при рендере на клиенте (без ожидания useEffect).
 * Иначе гонка: `useWebAuth` успевает вернуть «нет сессии», а флаг Telegram ещё false → редирект на /login.
 */
function subscribe(_onStoreChange: () => void) {
  return () => {};
}

function getTelegramMiniAppSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.Telegram?.WebApp?.initData?.trim());
}

function getTelegramMiniAppServerSnapshot(): boolean {
  return false;
}

/**
 * Hook для определения запущен ли сайт в Telegram Mini App или обычном браузере
 */
export function useIsTelegramMiniApp(): boolean {
  return useSyncExternalStore(
    subscribe,
    getTelegramMiniAppSnapshot,
    getTelegramMiniAppServerSnapshot
  );
}

/**
 * SSR-safe проверка для серверных компонентов
 */
export function checkIsTelegramMiniApp(): boolean {
  return getTelegramMiniAppSnapshot();
}
