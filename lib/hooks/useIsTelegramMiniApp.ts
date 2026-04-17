"use client";

import { useEffect, useState } from "react";

/**
 * Hook для определения запущен ли сайт в Telegram Mini App или обычном браузере
 */
export function useIsTelegramMiniApp(): boolean {
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Проверяем наличие Telegram WebApp API и initData
    const hasTelegramWebApp = Boolean(window.Telegram?.WebApp);
    const hasInitData = Boolean(window.Telegram?.WebApp?.initData);
    
    setIsTelegram(hasTelegramWebApp && hasInitData);
  }, []);

  return isTelegram;
}

/**
 * SSR-safe проверка для серверных компонентов
 */
export function checkIsTelegramMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.Telegram?.WebApp?.initData);
}
