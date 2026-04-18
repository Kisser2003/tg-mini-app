"use client";

import { useEffect, useId, useRef, useSyncExternalStore, type CSSProperties } from "react";

const BARS = 48;

function det(n: number, mod: number): number {
  return ((n * 7919) % mod + mod) % mod;
}

/** Фаза `phase` крутится во времени через rAF — волна непрерывно «едет». */
function buildWavePath(phase: number, width: number, mid: number, amp: number): string {
  const parts: string[] = [];
  for (let x = 0; x <= width; x += 3) {
    const t = (x / width) * Math.PI * 4 + phase;
    const envelope = 0.55 + 0.45 * Math.sin((x / width) * Math.PI);
    const y =
      mid +
      Math.sin(t) * amp * envelope +
      Math.sin(t * 2.15 + phase * 0.4) * amp * 0.24 +
      Math.sin(t * 0.5 + phase * 0.2) * amp * 0.12;
    if (x === 0) parts.push(`M 0 ${y.toFixed(2)}`);
    else parts.push(`L ${x} ${y.toFixed(2)}`);
  }
  return parts.join(" ");
}

function subscribeReducedMotion(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);
}

export function EmptyStateNeonWaveform({ className = "" }: { className?: string }) {
  const rawId = useId().replace(/:/g, "");
  const gradId = `${rawId}-wave-grad`;
  const glowId = `${rawId}-wave-glow`;
  const gradSoftId = `${rawId}-wave-soft`;

  const mainPathRef = useRef<SVGPathElement>(null);
  const softPathRef = useRef<SVGPathElement>(null);
  const thinPathRef = useRef<SVGPathElement>(null);

  const reducedMotion = usePrefersReducedMotion();

  const w = 360;
  const mid = 52;

  useEffect(() => {
    if (reducedMotion) {
      const p = 0;
      const dMain = buildWavePath(p, w, mid, 26);
      const dSoft = buildWavePath(p + 1.2, w, mid, 17);
      const dThin = buildWavePath(p + 2.4, w, mid, 12);
      mainPathRef.current?.setAttribute("d", dMain);
      softPathRef.current?.setAttribute("d", dSoft);
      thinPathRef.current?.setAttribute("d", dThin);
      return;
    }

    let raf = 0;
    const t0 = performance.now();

    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      // Скорость прокрутки фазы — заметное движение волны
      const phaseMain = t * 2.4;
      const phaseSoft = t * 1.55 + 0.8;
      const phaseThin = t * 1.9 + 1.6;

      mainPathRef.current?.setAttribute("d", buildWavePath(phaseMain, w, mid, 26));
      softPathRef.current?.setAttribute("d", buildWavePath(phaseSoft, w, mid, 17));
      thinPathRef.current?.setAttribute("d", buildWavePath(phaseThin, w, mid, 12));

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, w, mid]);

  const staticMain = buildWavePath(0, w, mid, 26);

  return (
    <div
      className={`relative mx-auto mb-8 h-[9.25rem] w-full max-w-lg overflow-visible ${className}`}
      aria-hidden
    >
      <div className="pointer-events-none absolute -bottom-2 left-1/2 h-24 w-[92%] -translate-x-1/2 rounded-[100%] bg-violet-500/15 blur-[28px] motion-safe:animate-empty-wave-glow motion-reduce:opacity-60" />
      <div className="pointer-events-none absolute inset-x-8 top-2 h-16 rounded-full bg-cyan-500/10 blur-2xl motion-reduce:opacity-40" />

      <div className="relative flex h-full flex-col justify-end pb-1">
        {/* Столбики: CSS keyframes (надёжнее motion.div в WebView) */}
        <div className="absolute inset-x-0 bottom-0 top-7 flex items-end justify-center gap-[2px] px-3">
          {Array.from({ length: BARS }, (_, i) => {
            const center = BARS / 2;
            const dist = Math.abs(i - center) / center;
            const peak = 1 - dist * 0.48;
            const mult = 0.38 + (det(i, 1000) / 1000) * 0.62;
            const dur = 1.2 + (det(i + 3, 100) / 100) * 0.75;
            return (
              <div
                key={`back-${i}`}
                className="h-full max-h-[5.25rem] w-[2px] shrink-0 origin-bottom rounded-full motion-safe:animate-empty-bar motion-reduce:opacity-40"
                style={
                  {
                    background: "linear-gradient(to top, rgba(99,102,241,0.2), rgba(139,92,246,0.45))",
                    ["--peak" as string]: Math.max(0.15, Math.min(0.98, peak * mult * 0.92)),
                    ["--bar-dur" as string]: `${dur}s`,
                    animationDelay: `${i * 0.036}s`
                  } as CSSProperties
                }
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
            const dur = 1.05 + (det(i + 11, 100) / 100) * 0.65;
            return (
              <div
                key={`front-${i}`}
                className="h-full max-h-[5.75rem] w-[2px] shrink-0 origin-bottom rounded-full motion-safe:animate-empty-bar motion-reduce:opacity-50"
                style={
                  {
                    background:
                      "linear-gradient(to top, rgba(34,211,238,0.45), rgba(167,139,250,0.95), rgba(192,132,252,1))",
                    boxShadow:
                      "0 0 12px rgba(167,139,250,0.45), 0 0 24px rgba(129,140,248,0.2), 0 -2px 20px rgba(34,211,238,0.15)",
                    ["--peak" as string]: Math.max(0.18, Math.min(1, peak * mult)),
                    ["--bar-dur" as string]: `${dur}s`,
                    animationDelay: `${i * 0.028 + 0.05}s`
                  } as CSSProperties
                }
              />
            );
          })}
        </div>

        <svg
          className="relative z-[1] w-full motion-safe:animate-empty-wave-breathe motion-reduce:translate-y-0"
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

          <path
            ref={softPathRef}
            d={staticMain}
            fill="none"
            stroke={`url(#${gradSoftId})`}
            strokeWidth={1.35}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
          />

          <path
            ref={mainPathRef}
            d={staticMain}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={2.35}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${glowId})`}
          />

          <path
            ref={thinPathRef}
            d={staticMain}
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={0.85}
            strokeLinecap="round"
            opacity={0.55}
          />
        </svg>
      </div>
    </div>
  );
}
