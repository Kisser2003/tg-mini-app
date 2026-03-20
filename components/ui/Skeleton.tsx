import type { HTMLAttributes } from "react";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * Пульсирующий блок-заглушка (премиальный слой загрузки).
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={["rounded-lg bg-white/5 animate-pulse", className].filter(Boolean).join(" ")}
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
      className="flex w-full items-center gap-3 rounded-[20px] border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-sm"
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

export function LibraryReleaseSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {Array.from({ length: count }, (_, i) => (
        <LibraryReleaseRowSkeleton key={i} />
      ))}
    </div>
  );
}
