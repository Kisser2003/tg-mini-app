"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";

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
      mainPathRef.current?.setAttribute("d", buildWavePath(p, w, mid, 26));
      softPathRef.current?.setAttribute("d", buildWavePath(p + 1.2, w, mid, 17));
      thinPathRef.current?.setAttribute("d", buildWavePath(p + 2.4, w, mid, 12));
      return;
    }

    let raf = 0;
    const t0 = performance.now();

    const tick = (now: number) => {
      const t = (now - t0) / 1000;
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
      className={`relative mx-auto mb-8 w-full max-w-lg overflow-visible ${className}`}
      aria-hidden
    >
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-28 w-[95%] -translate-x-1/2 rounded-[100%] bg-violet-500/18 blur-[32px] motion-safe:animate-empty-wave-glow motion-reduce:opacity-55" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-20 rounded-full bg-cyan-500/12 blur-3xl motion-reduce:opacity-45" />

      <div className="relative flex items-center justify-center py-2">
        <svg
          className="relative z-[1] w-full motion-safe:animate-empty-wave-breathe motion-reduce:translate-y-0"
          viewBox="0 0 360 104"
          preserveAspectRatio="xMidYMid meet"
          style={{ minHeight: "7.25rem", maxHeight: "9rem" }}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.85" />
              <stop offset="35%" stopColor="#a78bfa" stopOpacity="1" />
              <stop offset="70%" stopColor="#c084fc" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id={gradSoftId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="0.38" />
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
            strokeWidth={1.45}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.72}
          />

          <path
            ref={mainPathRef}
            d={staticMain}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${glowId})`}
          />

          <path
            ref={thinPathRef}
            d={staticMain}
            fill="none"
            stroke="rgba(255,255,255,0.42)"
            strokeWidth={0.9}
            strokeLinecap="round"
            opacity={0.58}
          />
        </svg>
      </div>
    </div>
  );
}
