"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/**
 * Плавное раскрытие блока по высоте (вместо мгновенного «прыжка» соседей).
 *
 * Отступ сверху задаётся через `innerClassName` (padding), а не `space-y` родителя:
 * margin на анимируемой обёртке не схлопывается вместе с высотой и дёргает соседей.
 */
export function Collapse({
  open,
  children,
  className,
  innerClassName
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="collapse"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            height: { duration: 0.34, ease: EASE_OUT },
            opacity: { duration: 0.22, ease: "easeOut" }
          }}
          className={cn("overflow-hidden", className)}
        >
          <div className={innerClassName}>{children}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Шеврон раскрытия: один значок, который поворачивается, а не подменяется вверх/вниз. */
export function CollapseChevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <ChevronDown
      className={cn(
        "h-4 w-4 shrink-0 text-omf-graphite transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        open && "rotate-180",
        className
      )}
      aria-hidden
    />
  );
}
