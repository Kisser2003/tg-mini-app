"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Глобальный fade между разделами (библиотека, релиз, админ…).
 * Маршруты `/create/*` без глобального fade — слайд шагов в `CreateShell` / `CreateStepTransition`.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const isCreateWizard = pathname.startsWith("/create");

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : isCreateWizard
      ? { duration: 0 }
      : { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };

  const instant = prefersReducedMotion || isCreateWizard;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className="relative min-h-app w-full min-w-0 overflow-x-hidden will-change-[opacity]"
        initial={{ opacity: instant ? 1 : 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: instant ? 1 : 0 }}
        transition={transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
