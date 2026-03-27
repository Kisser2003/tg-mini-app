"use client";

import { useEffect, useRef } from "react";
import { getTelegramWebApp } from "@/lib/telegram";

/**
 * Controls the Telegram WebApp native BackButton for the lifetime of the
 * calling component. Falls back gracefully when running outside Telegram.
 *
 * @param onBack  Called when the user taps the native back button.
 * @param enabled Set to false to hide the back button (e.g. on the first step).
 */
export function useTelegramBackButton(onBack: () => void, enabled = true): void {
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;

  useEffect(() => {
    const btn = getTelegramWebApp()?.BackButton;
    if (!btn) return;

    if (!enabled) {
      btn.hide();
      return;
    }

    const handler = () => handlerRef.current();
    btn.show();
    btn.onClick(handler);

    return () => {
      btn.offClick(handler);
      btn.hide();
    };
  }, [enabled]);
}
