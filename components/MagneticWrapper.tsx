"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

const DEFAULT_STRENGTH = 0.15;

type MagneticWrapperProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  /** Доля половины ширины/высоты контейнера (0.15 ≈ 15% от половины размера). */
  strength?: number;
};

/**
 * Лёгкий «магнит»: смещение контента к курсору/пальцу (onPointerMove / onMouseMove).
 */
export function MagneticWrapper({
  children,
  className = "",
  disabled = false,
  strength = DEFAULT_STRENGTH
}: MagneticWrapperProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [mag, setMag] = useState({ x: 0, y: 0 });

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      if (disabled) return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const nx = (e.clientX - cx) / (r.width / 2);
      const ny = (e.clientY - cy) / (r.height / 2);
      const capX = (r.width / 2) * strength;
      const capY = (r.height / 2) * strength;
      setMag({
        x: Math.max(-1, Math.min(1, nx)) * capX,
        y: Math.max(-1, Math.min(1, ny)) * capY
      });
    },
    [disabled, strength]
  );

  const onPointerLeave = useCallback(() => {
    setMag({ x: 0, y: 0 });
  }, []);

  return (
    <span
      ref={ref}
      className={`inline-flex will-change-transform ${className}`}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{ transform: `translate(${mag.x}px, ${mag.y}px)` }}
    >
      {children}
    </span>
  );
}
