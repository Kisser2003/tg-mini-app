"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Music } from "lucide-react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { hapticMap } from "@/lib/haptic-map";

const MAX_PULL = 96;
/** С какого оттяга отпускание запускает обновление. */
const TRIGGER_PULL = 78;

type PullRefreshBrandProps = {
  /** Зарезервировано: кастомный контейнер скролла. */
  scrollRoot?: HTMLElement | null;
  /**
   * Что делать, если оттянули до порога и отпустили. Без колбэка индикатор декоративный
   * (как было раньше): крутится от жеста, но ничего не обновляет.
   */
  onRefresh?: () => Promise<unknown> | void;
};

/**
 * Pull-to-refresh у верхней границы списка (touch).
 * Вращение/масштаб иконки от прогресса жеста; на пороге — щелчок хаптики,
 * после отпускания — крутится, пока идёт обновление, и мягко уезжает пружиной.
 */
export function PullRefreshBrand({ scrollRoot, onRefresh }: PullRefreshBrandProps) {
  const pull = useMotionValue(0);
  const rotate = useTransform(pull, [0, MAX_PULL], [0, 360]);
  const scale = useTransform(pull, [0, MAX_PULL], [0.65, 1.05]);
  const opacity = useTransform(pull, [0, 18, MAX_PULL], [0, 0.55, 1]);
  const [refreshing, setRefreshing] = useState(false);

  const startY = useRef(0);
  const pulling = useRef(false);
  const armed = useRef(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const getScrollTop = useCallback(() => {
    if (scrollRoot) return scrollRoot.scrollTop;
    return typeof window !== "undefined" ? window.scrollY : 0;
  }, [scrollRoot]);

  const settle = useCallback(() => {
    animate(pull, 0, { type: "spring", stiffness: 380, damping: 34 });
  }, [pull]);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (getScrollTop() > 2) return;
      pulling.current = true;
      armed.current = false;
      startY.current = e.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current) return;
      if (getScrollTop() > 2) {
        pull.set(0);
        armed.current = false;
        return;
      }
      const y = e.touches[0]?.clientY ?? 0;
      const delta = Math.max(0, y - startY.current);
      const next = Math.min(MAX_PULL, delta * 0.85);
      pull.set(next);
      if (!onRefreshRef.current) return;
      const shouldArm = next >= TRIGGER_PULL;
      if (shouldArm !== armed.current) {
        armed.current = shouldArm;
        if (shouldArm) hapticMap.impactLight();
      }
    };

    const onTouchEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      const run = onRefreshRef.current;
      if (!armed.current || !run) {
        settle();
        return;
      }
      armed.current = false;
      refreshingRef.current = true;
      setRefreshing(true);
      animate(pull, TRIGGER_PULL * 0.7, { type: "spring", stiffness: 380, damping: 34 });
      void Promise.resolve()
        .then(() => run())
        .catch(() => {})
        .finally(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          settle();
        });
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [getScrollTop, pull, settle]);

  return (
    <motion.div
      className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+8px)] z-[35] -translate-x-1/2"
      style={{ opacity }}
      aria-hidden={!refreshing}
      role={refreshing ? "status" : undefined}
      aria-label={refreshing ? "Обновляем" : undefined}
    >
      <motion.div
        style={{ rotate, scale }}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-omf-line bg-omf-surface"
      >
        <Music
          className={refreshing ? "h-5 w-5 animate-spin" : "h-5 w-5"}
          style={{ color: "var(--omf-ultra-text)" }}
          strokeWidth={1.6}
          aria-hidden
        />
      </motion.div>
    </motion.div>
  );
}
