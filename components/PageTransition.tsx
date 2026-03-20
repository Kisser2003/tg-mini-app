"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const isCreateFlow = pathname.startsWith("/create");

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : isCreateFlow
      ? { duration: 0.18, ease: "easeInOut" as const }
      : { duration: 0.3, ease: "easeInOut" as const };

  const initial = prefersReducedMotion
    ? { opacity: 0 }
    : isCreateFlow
      ? { opacity: 0, x: 4 }
      : { opacity: 0, x: 10 };

  const animate = prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 };

  const exit = prefersReducedMotion
    ? { opacity: 0 }
    : isCreateFlow
      ? { opacity: 0, x: -4 }
      : { opacity: 0, x: -10 };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className="will-change-transform-opacity relative min-h-[100dvh] w-full min-w-0 overflow-x-hidden"
        initial={initial}
        animate={animate}
        exit={exit}
        transition={transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
