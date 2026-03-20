"use client";

import { motion } from "framer-motion";
import { triggerHaptic } from "@/lib/telegram";

export function StepGate({
  title,
  description,
  actionLabel,
  onAction
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[24px] border border-white/8 bg-surface/80 px-5 py-5 text-text shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
    >
      <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-[13px] text-text-muted leading-relaxed">{description}</p>
      <button
        type="button"
        onClick={() => {
          triggerHaptic("light");
          onAction();
        }}
        className="mt-4 inline-flex h-[48px] w-full items-center justify-center rounded-[18px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[14px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.6)]"
      >
        {actionLabel}
      </button>
    </motion.div>
  );
}

