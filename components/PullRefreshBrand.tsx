"use client";

import { useCallback, useEffect, useRef } from "react";
import { Music } from "lucide-react";
import { motion, useMotionValue, useTransform } from "framer-motion";

const MAX_PULL = 96;

type PullRefreshBrandProps = {
  /** Зарезервировано: кастомный контейнер скролла. */
  scrollRoot?: HTMLElement | null;
};

/**
 * Индикатор при оттягивании вниз у верхней границы списка (touch).
 * Вращение/масштаб иконки от прогресса жеста (useMotionValue + useTransform).
 */
export function PullRefreshBrand({ scrollRoot }: PullRefreshBrandProps) {
  const pull = useMotionValue(0);
  const rotate = useTransform(pull, [0, MAX_PULL], [0, 360]);
  const scale = useTransform(pull, [0, MAX_PULL], [0.65, 1.05]);
  const opacity = useTransform(pull, [0, 18, MAX_PULL], [0, 0.55, 1]);

  const startY = useRef(0);
  const pulling = useRef(false);

  const getScrollTop = useCallback(() => {
    if (scrollRoot) return scrollRoot.scrollTop;
    return typeof window !== "undefined" ? window.scrollY : 0;
  }, [scrollRoot]);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (getScrollTop() > 2) return;
      pulling.current = true;
      startY.current = e.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current) return;
      if (getScrollTop() > 2) {
        pull.set(0);
        return;
      }
      const y = e.touches[0]?.clientY ?? 0;
      const delta = Math.max(0, y - startY.current);
      pull.set(Math.min(MAX_PULL, delta * 0.85));
    };

    const onTouchEnd = () => {
      pulling.current = false;
      pull.set(0);
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
  }, [getScrollTop, pull]);

  return (
    <motion.div
      className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+8px)] z-[35] -translate-x-1/2"
      style={{ opacity }}
    >
      <motion.div
        style={{ rotate, scale }}
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-black/35 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md"
      >
        <Music
          className="h-5 w-5"
          style={{ color: "var(--tg-theme-button-color, #3390ec)" }}
          strokeWidth={1.6}
          aria-hidden
        />
      </motion.div>
    </motion.div>
  );
}
