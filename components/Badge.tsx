import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Компактный pill для статусов и меток (glass-совместимый).
 */
export function Badge({ children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/75 backdrop-blur-md ${className}`}
    >
      {children}
    </span>
  );
}
