"use client";

import { motion } from "framer-motion";

const BARS = 36;

function barPeak(i: number): number {
  const center = BARS / 2;
  const dist = Math.abs(i - center) / center;
  return 1 - dist * 0.55;
}

function barScaleY(i: number): number {
  return 0.4 + (((i * 7919) % 1000) / 1000) * 0.6;
}

function barDuration(i: number): number {
  return 1.3 + (((i * 17) % 100) / 100) * 0.7;
}

/** Lovable-style bars; deterministic (no Math.random) for SSR/hydration. */
export function SoundwaveVisualizer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-28 max-h-full items-end justify-center gap-[2px] overflow-hidden ${className}`}
      aria-hidden
    >
      {Array.from({ length: BARS }, (_, i) => {
        const peak = barPeak(i);
        const mult = barScaleY(i);
        return (
          <motion.div
            key={i}
            className="w-[2px] origin-bottom rounded-full"
            style={{
              background: "linear-gradient(to top, #818cf8, #c084fc)",
              height: "100%"
            }}
            animate={{
              scaleY: [0.1, peak * mult, 0.1],
              opacity: [0.3, 0.95, 0.3]
            }}
            transition={{
              duration: barDuration(i),
              repeat: Infinity,
              delay: i * 0.04,
              ease: "easeInOut"
            }}
          />
        );
      })}
    </div>
  );
}
