"use client";

import type { HTMLAttributes } from "react";
import { motion } from "framer-motion";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * Пульсирующий блок-заглушка (премиальный слой загрузки).
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={["rounded-lg bg-white/[0.06] skeleton-shimmer-bg", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

/**
 * Скелетон строки релиза: квадрат обложки + две полоски текста (как в библиотеке).
 */
export function LibraryReleaseRowSkeleton() {
  return (
    <div
      className="flex min-h-[88px] w-full items-center gap-3 rounded-[20px] border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-sm"
      aria-hidden
    >
      <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-[70%] max-w-[220px]" />
        <Skeleton className="h-3 w-[40%] max-w-[120px]" />
      </div>
    </div>
  );
}

/** Скелетон очереди модерации — близко к высоте карточки в AdminReleaseCard. */
export function AdminModerationQueueSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="glass-card overflow-hidden rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
          aria-hidden
        >
          <div className="flex min-h-[120px] gap-3">
            <Skeleton className="h-[72px] w-[72px] shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-[88%] max-w-[260px] rounded-md" />
              <Skeleton className="h-3.5 w-[60%] max-w-[180px] rounded-md" />
              <Skeleton className="h-5 w-32 rounded-full" />
              <Skeleton className="h-3 w-full max-w-[220px] rounded-md" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Skeleton className="h-11 rounded-xl" />
            <Skeleton className="h-11 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

const librarySkeletonContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.05 }
  }
};

const librarySkeletonRow = {
  hidden: { opacity: 0.4, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }
  }
};

export function LibraryReleaseSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <motion.div
      className="grid grid-cols-1 gap-3"
      variants={librarySkeletonContainer}
      initial="hidden"
      animate="show"
    >
      {Array.from({ length: count }, (_, i) => (
        <motion.div key={i} variants={librarySkeletonRow}>
          <LibraryReleaseRowSkeleton />
        </motion.div>
      ))}
    </motion.div>
  );
}
