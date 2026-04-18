"use client";

import { motion } from "framer-motion";
import { useId, useMemo } from "react";

const BARS = 54;

function det(n: number, mod: number): number {
  return ((n * 7919) % mod + mod) % mod;
}

/** Детерминированная кривая (без Math.random) — стабильный SSR / гидрация. */
function buildWavePath(phase: number, width: number, mid: number, amp: number): string {
  const parts: string[] = [];
  for (let x = 0; x <= width; x += 3) {
    const t = (x / width) * Math.PI * 4 + phase * 0.012;
    const envelope = 0.55 + 0.45 * Math.sin((x / width) * Math.PI);
    const y = mid + Math.sin(t) * amp * envelope + Math.sin(t * 2.1 + phase * 0.008) * amp * 0.22;
    if (x === 0) parts.push(`M 0 ${y.toFixed(2)}`);
    else parts.push(`L ${x} ${y.toFixed(2)}`);
  }
  return parts.join(" ");
}

export function EmptyStateNeonWaveform({ className = "" }: { className?: string }) {
  const rawId = useId().replace(/:/g, "");
  const gradId = `${rawId}-wave-grad`;
  const glowId = `${rawId}-wave-glow`;
  const gradSoftId = `${rawId}-wave-soft`;

  const { pathA, pathB, pathC, pathCAlt } = useMemo(() => {
    const w = 360;
    const mid = 52;
    return {
      pathA: buildWavePath(0, w, mid, 26),
      pathB: buildWavePath(180, w, mid, 26),
      pathC: buildWavePath(320, w, mid, 18),
      pathCAlt: buildWavePath(480, w, mid, 18)
    };
  }, []);

  return (
    <div
      className={`relative mx-auto mb-8 h-[9.25rem] w-full max-w-lg overflow-visible ${className}`}
      aria-hidden
    >
      {/* Мягкое неоновое пятно под волной */}
      <div className="pointer-events-none absolute -bottom-2 left-1/2 h-24 w-[92%] -translate-x-1/2 rounded-[100%] bg-violet-500/15 blur-[28px]" />
      <div className="pointer-events-none absolute inset-x-8 top-2 h-16 rounded-full bg-cyan-500/10 blur-2xl" />

      <div className="relative flex h-full flex-col justify-end pb-1">
        {/* Две сетки столбиков — задняя тише, передняя ярче с неоновым свечением */}
        <div className="absolute inset-x-0 bottom-0 top-7 flex items-end justify-center gap-[2px] px-3">
          {Array.from({ length: BARS }, (_, i) => {
            const center = BARS / 2;
            const dist = Math.abs(i - center) / center;
            const peak = 1 - dist * 0.48;
            const mult = 0.38 + (det(i, 1000) / 1000) * 0.62;
            const dur = 1.35 + (det(i + 3, 100) / 100) * 0.75;
            return (
              <motion.div
                key={`back-${i}`}
                className="w-[2px] shrink-0 origin-bottom rounded-full"
                style={{
                  height: "100%",
                  maxHeight: "5.25rem",
                  background: "linear-gradient(to top, rgba(99,102,241,0.2), rgba(139,92,246,0.45))",
                  opacity: 0.85
                }}
                animate={{
                  scaleY: [0.1, peak * mult * 0.92, 0.12, peak * mult * 0.78, 0.1],
                  opacity: [0.2, 0.55, 0.25, 0.5, 0.2]
                }}
                transition={{
                  duration: dur,
                  repeat: Infinity,
                  delay: i * 0.032,
                  ease: "easeInOut"
                }}
              />
            );
          })}
        </div>

        <div className="absolute inset-x-0 bottom-0 top-5 flex items-end justify-center gap-[2px] px-3">
          {Array.from({ length: BARS }, (_, i) => {
            const center = BARS / 2;
            const dist = Math.abs(i - center) / center;
            const peak = 1 - dist * 0.42;
            const mult = 0.42 + (det(i + 400, 1000) / 1000) * 0.58;
            const dur = 1.15 + (det(i + 11, 100) / 100) * 0.65;
            return (
              <motion.div
                key={`front-${i}`}
                className="w-[2px] shrink-0 origin-bottom rounded-full"
                style={{
                  height: "100%",
                  maxHeight: "5.75rem",
                  background: "linear-gradient(to top, rgba(34,211,238,0.45), rgba(167,139,250,0.95), rgba(192,132,252,1))",
                  boxShadow:
                    "0 0 12px rgba(167,139,250,0.45), 0 0 24px rgba(129,140,248,0.2), 0 -2px 20px rgba(34,211,238,0.15)"
                }}
                animate={{
                  scaleY: [0.12, peak * mult, 0.14, peak * mult * 0.88, 0.12],
                  opacity: [0.35, 1, 0.4, 0.92, 0.35]
                }}
                transition={{
                  duration: dur,
                  repeat: Infinity,
                  delay: i * 0.026 + 0.06,
                  ease: "easeInOut"
                }}
              />
            );
          })}
        </div>

        {/* Плавные неоновые линии-осциллограммы поверх столбиков */}
        <svg
          className="relative z-[1] w-full"
          viewBox="0 0 360 104"
          preserveAspectRatio="xMidYMid meet"
          style={{ minHeight: "6.5rem" }}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.85" />
              <stop offset="35%" stopColor="#a78bfa" stopOpacity="1" />
              <stop offset="70%" stopColor="#c084fc" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id={gradSoftId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="0.35" />
            </linearGradient>
            <filter id={glowId} x="-15%" y="-15%" width="130%" height="130%">
              <feGaussianBlur stdDeviation="1.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <motion.path
            d={pathC}
            fill="none"
            stroke={`url(#${gradSoftId})`}
            strokeWidth={1.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.65}
            animate={{ d: [pathC, pathCAlt, pathC] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
          />

          <motion.path
            d={pathA}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${glowId})`}
            animate={{ d: [pathA, pathB, pathA] }}
            transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
          />

          <motion.path
            d={pathB}
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={0.75}
            strokeLinecap="round"
            opacity={0.5}
            animate={{ d: [pathB, pathA, pathB] }}
            transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
      </div>
    </div>
  );
}
