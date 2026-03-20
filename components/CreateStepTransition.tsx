"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const STEP_ORDER = ["metadata", "assets", "tracks", "review", "success"] as const;

function stepIndexForPathname(pathname: string): number {
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  if (parts.length === 1 && last === "create") return 0;
  const i = STEP_ORDER.indexOf(last as (typeof STEP_ORDER)[number]);
  return i >= 0 ? i : -1;
}

/**
 * Плавная смена шагов мастера /create/* (slide по направлению вперёд/назад).
 */
export function CreateStepTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const prevIdxRef = useRef<number | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);

  useEffect(() => {
    const cur = stepIndexForPathname(pathname);
    const prev = prevIdxRef.current;
    if (cur < 0) return;
    if (prev !== null && prev >= 0) {
      setDirection(cur >= prev ? 1 : -1);
    }
    prevIdxRef.current = cur;
  }, [pathname]);

  const forward = direction === 1;
  const xEnter = prefersReducedMotion ? 0 : forward ? 24 : -24;
  const xExit = prefersReducedMotion ? 0 : forward ? -24 : 24;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className="w-full min-w-0"
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: xEnter }}
        animate={{ opacity: 1, x: 0 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: xExit }}
        transition={
          prefersReducedMotion ? { duration: 0 } : { duration: 0.28, ease: "easeInOut" }
        }
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
