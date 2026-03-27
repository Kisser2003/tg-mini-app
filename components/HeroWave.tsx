"use client";

import { motion } from "framer-motion";

const BARS = 40;

/** Детерминированные амплитуды — без Math.random() (SSR / гидратация). */
function barVariation(i: number): number {
  return 0.3 + (((i * 7919) % 1000) / 1000) * 0.7;
}

function barDuration(i: number): number {
  return 1.6 + (((i * 17) % 100) / 100) * 1;
}

/** Тихая волна за hero-текстом (lovable Dashboard). */
export function HeroWave() {
  const center = BARS / 2;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.07]">
      <div className="flex h-full w-full items-end gap-[2px] px-4">
        {Array.from({ length: BARS }, (_, i) => {
          const dist = Math.abs(i - center) / center;
          const maxScale = 1 - dist * 0.7;
          const mult = barVariation(i);
          return (
            <motion.div
              key={i}
              className="origin-bottom flex-1 rounded-full"
              style={{
                background: "linear-gradient(to top, #818cf8, #c084fc)",
                height: "100%"
              }}
              animate={{
                scaleY: [0.08, maxScale * mult, 0.08]
              }}
              transition={{
                duration: barDuration(i),
                repeat: Infinity,
                delay: i * 0.03,
                ease: "easeInOut"
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
