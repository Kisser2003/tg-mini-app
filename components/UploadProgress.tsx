"use client";

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionValueEvent
} from "framer-motion";
import { useEffect, useState } from "react";

type Props = {
  label: string;
  /** 0–100 */
  progress: number;
  className?: string;
};

export function UploadProgress({ label, progress, className = "" }: Props) {
  const clamped = Math.max(0, Math.min(100, progress));
  const progressMv = useMotionValue(clamped);
  const widthSpring = useSpring(progressMv, { stiffness: 110, damping: 20, mass: 0.45 });
  const numberSpring = useSpring(progressMv, { stiffness: 130, damping: 24, mass: 0.35 });

  const scaleX = useTransform(widthSpring, (v) => {
    const t = Math.max(0, Math.min(100, v));
    return t / 100;
  });

  const [displayPct, setDisplayPct] = useState(Math.round(clamped));
  useMotionValueEvent(numberSpring, "change", (v) => {
    setDisplayPct(Math.round(Math.max(0, Math.min(100, v))));
  });

  useEffect(() => {
    progressMv.set(clamped);
  }, [clamped, progressMv]);

  return (
    <div
      className={`rounded-control border border-omf-line bg-omf-surface px-4 py-3.5 ${className}`}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2 text-[14px] text-omf-ink">
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="tabular-nums text-omf-ultra-text">{displayPct}%</span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-omf-line">
        <motion.div
          className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-omf-ultra will-change-transform"
          style={{ scaleX }}
        />
      </div>
    </div>
  );
}
