"use client";

import type { CanonicalReleaseStatus } from "@/lib/release-status";
import { ReleaseSleeve } from "@/components/ReleaseSleeve";
import { cn } from "@/lib/utils";

export type ReleaseCardProps = {
  id: string;
  title: string;
  artist?: string | null;
  /** Одна строка под названием: тип и дата, без статуса — статус на наклейке. */
  subtitle: string;
  status: CanonicalReleaseStatus;
  coverUrl?: string | null;
  priority?: boolean;
  busy?: boolean;
  /** Решение модератора, которое ещё не открывали. */
  isNew?: boolean;
  onClick?: () => void;
};

/** Плитка библиотеки: конверт релиза с наклейкой статуса. */
export function ReleaseCard({
  id,
  title,
  artist,
  subtitle,
  status,
  coverUrl,
  priority,
  busy,
  isNew,
  onClick
}: ReleaseCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "omf-focus group block w-full min-w-0 rounded-sleeve text-left transition-transform duration-150 active:scale-[0.98]",
        busy && "opacity-60"
      )}
    >
      <div className="relative">
        <ReleaseSleeve
          seed={id}
          title={title}
          artist={artist}
          coverUrl={coverUrl}
          status={status}
          priority={priority}
        />
        {isNew ? (
          <span
            className="absolute right-2 top-2 rounded-full bg-omf-ultra px-2 py-0.5 text-[11px] font-bold text-white shadow-md"
            aria-label="Новое решение по релизу"
          >
            Новое
          </span>
        ) : null}
      </div>
      <span className="mt-2.5 block truncate text-[14px] font-medium leading-tight text-omf-ink">
        {title}
      </span>
      <span className="mt-0.5 block truncate text-[12px] text-omf-graphite">
        {busy ? "Открываем черновик…" : subtitle}
      </span>
    </button>
  );
}
