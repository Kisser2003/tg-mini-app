"use client";

import { usePathname } from "next/navigation";
import { getNavigationId, notePathname } from "@/lib/route-transition-state";
import { cn } from "@/lib/utils";

/**
 * Появление экрана при переходе между разделами (библиотека, релиз, админ…).
 *
 * Только вход, без выхода: в App Router уходящая страница при exit-анимации рендерит уже
 * новый контент (контекст роутера обновился), и раньше это давало мигание «новый экран →
 * гаснет → появляется снова» плюс 300 мс задержки на каждый тап по табу.
 *
 * CSS-анимация вместо framer: не зависит от JS-кадров (не «зависает» на opacity 0 в Safari)
 * и после окончания не оставляет transform на обёртке.
 *
 * Первый экран после запуска не анимируется — Telegram уже показал свою заставку.
 * `/create/*` анимирует `CreateStepTransition` (направление шага).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  notePathname(pathname);
  const animate = getNavigationId() > 1 && !pathname.startsWith("/create");

  return (
    <div
      key={pathname}
      className={cn("relative min-h-app w-full min-w-0 overflow-x-hidden", animate && "omf-page-enter")}
    >
      {children}
    </div>
  );
}
