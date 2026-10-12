"use client";

import { memo } from "react";
import type { ReactNode } from "react";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  /** Оставлено для совместимости: оформление «стекла» убрано. */
  variant?: "default" | "success";
  /** Оставлено для совместимости: блика больше нет. */
  shimmer?: boolean;
};

/** Плоская рамка на графитовой поверхности (раньше — стеклянная карточка с бликом). */
function GlassCardInner({ children, className = "", variant = "default" }: GlassCardProps) {
  return (
    <div
      className={`rounded-control border bg-omf-surface p-4 ${
        variant === "success" ? "border-omf-green" : "border-omf-line"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export const GlassCard = memo(GlassCardInner);
