"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

type StatsTileProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  delay?: number;
  accentClass?: string;
};

export function StatsTile({
  icon: Icon,
  label,
  value,
  delay = 0,
  accentClass = "gradient-text"
}: StatsTileProps) {
  return (
    <motion.div
      className="glass-glow glass-glow-charged min-w-0 flex-1 p-5"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-4 flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06]">
        <Icon size={14} className="text-white/50" />
      </div>
      <p
        className={`font-display text-3xl font-extrabold leading-none tracking-tighter ${accentClass}`}
      >
        {value}
      </p>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
        {label}
      </p>
    </motion.div>
  );
}
