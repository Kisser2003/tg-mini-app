"use client";

import { useEffect, useRef, useState } from "react";

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

function getDocumentScrollTop(): number {
  return (
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  );
}

/**
 * Направление скролла по документу (window).
 * Вниз — скрыть таббар; вверх — показать.
 * passive + throttle + rAF; touchmove на document для тач-сценариев.
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

    const canScroll = () =>
      document.documentElement.scrollHeight > window.innerHeight + 2;

    lastScrollTopRef.current = getDocumentScrollTop();

    const runScrollLogic = () => {
      pendingScrollRef.current = false;
      rafRef.current = null;

      if (!canScroll()) {
        setIsVisible(true);
        return;
      }

      const st = getDocumentScrollTop();
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

    window.addEventListener("scroll", onScroll, { passive: true, capture: false });
    document.addEventListener("touchmove", onScroll, { passive: true, capture: false });
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    ro?.observe(document.documentElement);
    onResize();

    return () => {
      window.removeEventListener("scroll", onScroll);
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
