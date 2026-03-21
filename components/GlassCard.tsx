"use client";

import { useCallback } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import type { ReactNode } from "react";
import { SPRING_PHYSICS, SPRING_UI } from "@/lib/motion-spring";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  /** Мягкое «готовое» свечение (например, релиз опубликован). */
  variant?: "default" | "success";
  /** Анимированный блик по карточке (раз в ~5 с). По умолчанию включён. */
  shimmer?: boolean;
};

export function GlassCard({
  children,
  className = "",
  variant = "default",
  shimmer = true
}: GlassCardProps) {
  const isSuccess = variant === "success";

  const shineX = useMotionValue(50);
  const shineY = useMotionValue(50);
  const sx = useSpring(shineX, SPRING_PHYSICS);
  const sy = useSpring(shineY, SPRING_PHYSICS);
  const shineBg = useMotionTemplate`radial-gradient(circle 48% at ${sx}% ${sy}%, color-mix(in srgb, var(--tg-theme-button-color, #3390ec) 28%, rgba(255,255,255,0.35)) 0%, transparent 58%)`;

  const onPointerCapture = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
    shineX.set(x);
    shineY.set(y);
  }, [shineX, shineY]);

  const onPointerLeave = useCallback(() => {
    shineX.set(50);
    shineY.set(50);
  }, [shineX, shineY]);

  const accentShadow = isSuccess
    ? "0 20px 70px rgba(0,0,0,0.45), 0 0 48px color-mix(in srgb, var(--tg-theme-button-color, #22c55e) 22%, transparent), 0 0 72px rgba(139,92,246,0.12)"
    : "0 20px 70px rgba(0,0,0,0.45)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 0.995 }}
      whileTap={{ scale: 0.98 }}
      transition={SPRING_UI}
      onPointerMoveCapture={onPointerCapture}
      onPointerLeave={onPointerLeave}
      className={`relative overflow-hidden rounded-[24px] border bg-white/[0.02] p-4 backdrop-blur-3xl ${
        isSuccess ? "border-white/20" : "border-white/10"
      } ${className}`}
      style={{
        boxShadow: accentShadow
      }}
    >
      {shimmer && (
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
          aria-hidden
        >
          <div className="glass-card-shimmer-bar absolute inset-y-0 w-[45%] -translate-x-full skew-x-[-12deg] bg-gradient-to-r from-transparent via-white/14 to-transparent opacity-[0.55]" />
        </div>
      )}
      <motion.div
        className="pointer-events-none absolute inset-0 z-[2] mix-blend-soft-light"
        style={{ backgroundImage: shineBg }}
        aria-hidden
      />
      <div className="relative z-[3]">{children}</div>
    </motion.div>
  );
}
