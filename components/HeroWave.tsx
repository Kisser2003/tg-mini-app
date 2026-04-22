"use client";

import { type CSSProperties } from "react";

const BARS = 36;

function barVariation(i: number): number {
  return 0.3 + (((i * 7919) % 1000) / 1000) * 0.7;
}

function barDuration(i: number): number {
  return 1.6 + (((i * 17) % 100) / 100) * 1;
}

/**
 * Тихая волна за hero-текстом. Раньше — Framer motion.div × 40 (в WebView часто не крутилось);
 * сейчас CSS keyframes + per-bar --peak / --bar-dur.
 */
export function HeroWave() {
  const center = BARS / 2;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.11] motion-reduce:opacity-[0.06]">
      <div className="flex h-full w-full items-end gap-[2px] px-4">
        {Array.from({ length: BARS }, (_, i) => {
          const dist = Math.abs(i - center) / center;
          const maxScale = 1 - dist * 0.7;
          const mult = barVariation(i);
          const peak = Math.max(0.12, Math.min(0.98, maxScale * mult));
          const dur = barDuration(i);
          return (
            <div
              key={i}
              className="origin-bottom flex-1 rounded-full motion-safe:animate-hero-wave-bar motion-reduce:animate-none"
              style={
                {
                  background:
                    "linear-gradient(to top, var(--ss-neon-blue), var(--ss-neon-pink))",
                  height: "100%",
                  ["--peak" as string]: peak,
                  ["--bar-dur" as string]: `${dur}s`,
                  animationDelay: `${i * 0.03}s`
                } as CSSProperties
              }
            />
          );
        })}
      </div>
    </div>
  );
}
