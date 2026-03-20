"use client";

import { useEffect, useRef, useState } from "react";

export const APP_MAIN_SCROLL_ID = "app-main-scroll";

type UseScrollDirectionOptions = {
  /** Если false — таббар всегда виден (например на `/create/success`). */
  enabled: boolean;
  /** Сброс видимости и перепривязка при смене маршрута. */
  pathname: string;
  /** Минимальная дельта scrollTop за событие, чтобы среагировать (px). */
  threshold?: number;
};

/** Минимальный интервал между обработками (мс): меньше нагрузки на главный поток, плавнее скролл. */
const SCROLL_THROTTLE_MS = 75;

/**
 * Определяет направление скролла основного контейнера приложения.
 * Вниз по контенту (scrollTop растёт) — скрыть таббар; вверх — показать.
 * passive: true + throttle + rAF — не блокируем нативный скролл и не пересчитываем таббар на каждый пиксель.
 */
export function useScrollDirection({
  enabled,
  pathname,
  threshold = 16
}: UseScrollDirectionOptions): boolean {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollTopRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const pendingScrollRef = useRef(false);
  const lastThrottleAtRef = useRef(0);
  const throttleTrailingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsVisible(true);
  }, [pathname]);

  useEffect(() => {
    if (!enabled) {
      setIsVisible(true);
      return;
    }

    const el = document.getElementById(APP_MAIN_SCROLL_ID);
    if (!el) return;

    const canScroll = () => el.scrollHeight > el.clientHeight + 2;

    lastScrollTopRef.current = el.scrollTop;

    const runScrollLogic = () => {
      pendingScrollRef.current = false;
      rafRef.current = null;

      if (!canScroll()) {
        setIsVisible(true);
        return;
      }

      const st = el.scrollTop;
      const delta = st - lastScrollTopRef.current;
      lastScrollTopRef.current = st;

      if (st <= 8) {
        setIsVisible(true);
        return;
      }

      if (delta > threshold) {
        setIsVisible(false);
      } else if (delta < -threshold) {
        setIsVisible(true);
      }
    };

    const scheduleRun = () => {
      if (pendingScrollRef.current) return;
      pendingScrollRef.current = true;
      rafRef.current = requestAnimationFrame(runScrollLogic);
    };

    /**
     * Источник — scrollTop #app-main-scroll (не window). Тот же throttle для scroll и touchmove:
     * на таче иногда полезно ловить движение пальца, пока нативный scroll «догоняет».
     */
    const onScroll = () => {
      const now = Date.now();
      const elapsed = now - lastThrottleAtRef.current;

      if (elapsed >= SCROLL_THROTTLE_MS) {
        lastThrottleAtRef.current = now;
        if (throttleTrailingRef.current != null) {
          clearTimeout(throttleTrailingRef.current);
          throttleTrailingRef.current = null;
        }
        scheduleRun();
        return;
      }

      if (throttleTrailingRef.current != null) {
        clearTimeout(throttleTrailingRef.current);
      }
      throttleTrailingRef.current = setTimeout(() => {
        throttleTrailingRef.current = null;
        lastThrottleAtRef.current = Date.now();
        scheduleRun();
      }, SCROLL_THROTTLE_MS - elapsed);
    };

    const onResize = () => {
      if (!canScroll()) setIsVisible(true);
    };

    el.addEventListener("scroll", onScroll, { passive: true, capture: false });
    document.addEventListener("touchmove", onScroll, { passive: true, capture: false });
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    ro?.observe(el);
    onResize();

    return () => {
      el.removeEventListener("scroll", onScroll);
      document.removeEventListener("touchmove", onScroll);
      ro?.disconnect();
      if (throttleTrailingRef.current != null) {
        clearTimeout(throttleTrailingRef.current);
        throttleTrailingRef.current = null;
      }
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
      pendingScrollRef.current = false;
    };
  }, [enabled, pathname, threshold]);

  return isVisible;
}
