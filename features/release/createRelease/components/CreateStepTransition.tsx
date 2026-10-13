"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { getCreateStepIndexFromPath } from "@/lib/create-steps";
import { getNavigationId, getPreviousPathname } from "@/lib/route-transition-state";

const OFFSET_PX = 28;

type StepEnter = "forward" | "back" | "fade" | "none";

/**
 * Последний экран мастера, который уже анимировался. У каждой страницы `/create/*` свой
 * инстанс Shell, и одна страница может перемонтировать его (лоадер → контент) —
 * повторно «въезжать» в таком случае не нужно.
 */
let lastEnter: { path: string; navigationId: number } | null = null;

function resolveStepEnter(pathname: string): StepEnter {
  const navigationId = getNavigationId();
  if (lastEnter && lastEnter.path === pathname && lastEnter.navigationId === navigationId) {
    return "fade";
  }
  const prev = getPreviousPathname();
  if (prev === null) return "none";
  if (!prev.startsWith("/create")) return "forward";
  const from = getCreateStepIndexFromPath(prev);
  const to = getCreateStepIndexFromPath(pathname);
  if (to > from) return "forward";
  if (to < from) return "back";
  return "fade";
}

/**
 * Слайд шага мастера: вперёд — справа, назад — слева. Только вход (см. `PageTransition`).
 * Раньше здесь был `AnimatePresence initial={false}` внутри каждой страницы — он монтировался
 * заново на каждом шаге и поэтому никогда не анимировал.
 */
export function CreateStepTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [enter] = useState<StepEnter>(() => resolveStepEnter(pathname));

  useEffect(() => {
    lastEnter = { path: pathname, navigationId: getNavigationId() };
  }, [pathname]);

  const className =
    enter === "forward" || enter === "back"
      ? "omf-step-enter"
      : enter === "fade"
        ? "omf-fade-enter"
        : undefined;
  const style =
    enter === "back"
      ? ({ "--omf-step-from": `-${OFFSET_PX}px` } as CSSProperties)
      : enter === "forward"
        ? ({ "--omf-step-from": `${OFFSET_PX}px` } as CSSProperties)
        : undefined;

  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
