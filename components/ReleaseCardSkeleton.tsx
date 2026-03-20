"use client";

import { motion } from "framer-motion";

export function ReleaseCardSkeleton() {
  return (
    <div
      className="rounded-[20px] border border-white/[0.08] bg-surface/60 px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
      aria-hidden
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-[55%] rounded-lg bg-white/10" />
          <div className="h-3 w-[35%] rounded-md bg-white/5" />
        </div>
        <div className="h-7 w-20 shrink-0 rounded-full bg-white/10" />
      </div>
    </div>
  );
}

export function ReleaseCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0.6 }}
          animate={{ opacity: [0.5, 0.85, 0.5] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.12
          }}
        >
          <ReleaseCardSkeleton />
        </motion.div>
      ))}
    </div>
  );
}
