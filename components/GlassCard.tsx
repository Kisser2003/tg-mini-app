"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type GlassCardProps = {
  children: ReactNode;
  className?: string;
};

export function GlassCard({ children, className = "" }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 0.995 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className={`rounded-[24px] border border-white/10 bg-white/[0.02] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.45)] backdrop-blur-3xl ${className}`}
    >
      {children}
    </motion.div>
  );
}
