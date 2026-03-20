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

  const widthPct = useTransform(widthSpring, (v) => `${Math.max(0, Math.min(100, v))}%`);

  const [displayPct, setDisplayPct] = useState(Math.round(clamped));
  useMotionValueEvent(numberSpring, "change", (v) => {
    setDisplayPct(Math.round(Math.max(0, Math.min(100, v))));
  });

  useEffect(() => {
    progressMv.set(clamped);
  }, [clamped, progressMv]);

  return (
    <div
      className={`rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 backdrop-blur-md ${className}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-white/70">
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="tabular-nums text-white/90">{displayPct}%</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10 backdrop-blur-sm">
        <motion.div
          className="h-full max-w-full rounded-full bg-gradient-to-r from-sky-400 via-violet-400 to-fuchsia-400"
          style={{
            width: widthPct,
            boxShadow:
              "0 0 20px rgba(56, 189, 248, 0.45), 0 0 12px rgba(167, 139, 250, 0.35)"
          }}
        />
      </div>
    </div>
  );
}
