"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { getCreateStepIndexFromPath } from "@/lib/create-steps";

const OFFSET = 44;

/** Сохраняем путь между монтированиями разных страниц `/create/*` (у каждой страницы свой инстанс Shell). */
let modulePrevCreatePath: string | null = null;

export function CreateStepTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  const direction = useMemo(() => {
    const prev = modulePrevCreatePath;
    if (prev === null) {
      return 1;
    }
    const from = getCreateStepIndexFromPath(prev);
    const to = getCreateStepIndexFromPath(pathname);
    return to >= from ? 1 : -1;
  }, [pathname]);

  useLayoutEffect(() => {
    modulePrevCreatePath = pathname;
  }, [pathname]);

  const variants = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 }
      }
    : {
        initial: { opacity: 0, x: direction === 1 ? OFFSET : -OFFSET },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: direction === 1 ? -OFFSET : OFFSET }
      };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={
          prefersReducedMotion
            ? { duration: 0.15 }
            : { type: "spring", damping: 26, stiffness: 220 }
        }
        style={{ willChange: "transform, opacity" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
