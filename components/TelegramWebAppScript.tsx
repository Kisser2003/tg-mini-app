"use client";

import { useEffect } from "react";
import {
  initTelegramWebApp,
  isTelegramClientShell,
  persistTelegramShellSignalsFromUrl
} from "@/lib/telegram";

const SCRIPT_ID = "telegram-web-app-js";
const TELEGRAM_SCRIPT_SRC = "https://telegram.org/js/telegram-web-app.js";

/**
 * Подключает `telegram-web-app.js` только в окружении Telegram (UA / WebApp / cookie).
 * Обычный веб (Safari, Chrome) не трогает telegram.org — в ряде сетей он заблокирован
 * и «висит», ломая загрузку остальных скриптов/стилей.
 */
export function TelegramWebAppScript() {
  if (typeof window !== "undefined") {
    persistTelegramShellSignalsFromUrl();
  }

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isTelegramClientShell()) return;
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      initTelegramWebApp();
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = TELEGRAM_SCRIPT_SRC;
    s.async = true;
    s.onload = () => {
      initTelegramWebApp();
    };
    document.head.appendChild(s);
  }, []);

  return null;
}
