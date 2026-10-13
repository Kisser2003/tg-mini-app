"use client";

import type { CSSProperties } from "react";
import type { CanonicalReleaseStatus } from "@/lib/release-status";
import { ReleaseSleeve } from "@/components/ReleaseSleeve";
import { cn } from "@/lib/utils";

export type ReleaseCardProps = {
  id: string;
  title: string;
  artist?: string | null;
  /** Тип и дата: мелко, под строкой «что дальше». */
  subtitle: string;
  /** Что делать дальше / сколько ждать (цвет по смыслу). */
  nextStep?: { text: string; className: string } | null;
  status: CanonicalReleaseStatus;
  coverUrl?: string | null;
  priority?: boolean;
  busy?: boolean;
  /** Решение модератора, которое ещё не открывали. */
  isNew?: boolean;
  onClick?: () => void;
  /**
   * Номер в каскаде появления сетки (null — без анимации).
   * Ограничен сверху, чтобы длинный список не «доезжал» секунду.
   */
  revealIndex?: number | null;
};

const MAX_REVEAL_STEP = 7;

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
  nextStep,
  onClick,
  revealIndex = null
}: ReleaseCardProps) {
  const revealStyle =
    revealIndex != null
      ? ({ "--omf-i": Math.min(revealIndex, MAX_REVEAL_STEP) } as CSSProperties)
      : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={revealStyle}
      className={cn(
        "omf-focus omf-press group block w-full min-w-0 rounded-sleeve text-left",
        revealIndex != null && "omf-stagger-in",
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
          stickerSlapDelayMs={isNew ? 260 + Math.min(revealIndex ?? 0, MAX_REVEAL_STEP) * 45 : undefined}
        />
        {isNew ? (
          <span
            className="omf-pop-in absolute right-2 top-2 rounded-full bg-omf-ultra px-2 py-0.5 text-[11px] font-bold text-white shadow-md"
            style={{ "--omf-delay": "520ms" } as CSSProperties}
            aria-label="Новое решение по релизу"
          >
            Новое
          </span>
        ) : null}
      </div>
      <span className="mt-2.5 block truncate text-[14px] font-medium leading-tight text-omf-ink">
        {title}
      </span>
      {busy ? (
        <span className="omf-fade-enter mt-0.5 block truncate text-[12px] text-omf-graphite">Открываем…</span>
      ) : (
        <>
          {nextStep?.text ? (
            <span className={cn("mt-0.5 block truncate text-[13px] leading-snug", nextStep.className)}>
              {nextStep.text}
            </span>
          ) : null}
          {subtitle ? (
            <span className="mt-0.5 block truncate text-[12px] text-omf-faint">{subtitle}</span>
          ) : null}
        </>
      )}
    </button>
  );
}
