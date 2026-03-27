"use client";

import { useEffect, useRef, useState } from "react";

function readScrollY(): number {
  if (typeof window === "undefined") return 0;
  return (
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  );
}

/**
 * Скрывает «хром» (нижний бар) при скролле вниз, показывает при скролле вверх или у верха страницы.
 */
export function useHideOnScrollDown(options?: {
  delta?: number;
  topAlwaysVisibleBelow?: number;
}): boolean {
  const delta = options?.delta ?? 12;
  const topAlwaysVisibleBelow = options?.topAlwaysVisibleBelow ?? 32;
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = readScrollY();
    const onScroll = () => {
      const y = readScrollY();
      if (y <= topAlwaysVisibleBelow) {
        setVisible(true);
      } else if (y > lastY.current + delta) {
        setVisible(false);
      } else if (y < lastY.current - delta) {
        setVisible(true);
      }
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [delta, topAlwaysVisibleBelow]);

  return visible;
}
