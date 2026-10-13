"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { hapticMap } from "@/lib/haptic-map";
import { hasNavigatedInApp } from "@/lib/route-transition-state";
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

/**
 * «Назад» для вложенного экрана: показывает нативную кнопку в шапке Telegram и возвращает
 * колбэк для такой же кнопки в интерфейсе.
 *
 * Если экран открыт первым (прямая ссылка из бота), истории внутри приложения нет и
 * `router.back()` никуда не ведёт — тогда уходим на `fallbackHref`.
 */
export function useBackNavigation(fallbackHref: string): () => void {
  const router = useRouter();

  const goBack = useCallback(() => {
    hapticMap.impactLight();
    if (hasNavigatedInApp() && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(fallbackHref);
  }, [router, fallbackHref]);

  useTelegramBackButton(goBack);
  return goBack;
}
