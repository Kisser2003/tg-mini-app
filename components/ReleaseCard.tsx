"use client";

import { motion } from "framer-motion";
import { ExternalLink, Music } from "lucide-react";
import { openSmartLink } from "@/lib/open-smart-link";

export type ReleaseStatus = "draft" | "processing" | "ready" | "error";

export type ReleaseCardProps = {
  title: string;
  artist: string;
  status: ReleaseStatus;
  meta?: string[];
  coverUrl?: string;
  index?: number;
  onClick?: () => void;
  /** Публичная ссылка после выпуска (показ кнопки на карточке). */
  smartLinkUrl?: string | null;
};

const statusConfig: Record<ReleaseStatus, { label: string; ledClass: string }> = {
  draft: { label: "Draft", ledClass: "led-gray" },
  processing: { label: "In Review", ledClass: "led-amber" },
  ready: { label: "Ready", ledClass: "led-green" },
  error: { label: "Error", ledClass: "led-red" }
};

/** Lovable ReleaseCard — glass row + LED status; optional onClick for navigation. */
export function ReleaseCard({
  title,
  artist,
  status,
  meta = [],
  coverUrl,
  index = 0,
  onClick,
  smartLinkUrl
}: ReleaseCardProps) {
  const cfg = statusConfig[status];

  return (
    <motion.div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`glass-glow glass-glow-charged group flex cursor-pointer items-center gap-4 p-4 ${
        onClick ? "select-none" : ""
      }`}
      initial={{ opacity: 0, x: -28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.01, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.04]">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote Supabase/CDN URLs
          <img src={coverUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <Music size={20} className="text-white/20" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight text-white/90">{title}</p>
        <p className="mt-0.5 truncate text-xs text-white/30">{artist}</p>
        {meta.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {meta.map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium tracking-wide text-white/55"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}
        {smartLinkUrl?.trim() ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openSmartLink(smartLinkUrl);
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/35 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/15 py-2.5 text-[12px] font-semibold tracking-tight text-violet-100 shadow-[0_0_18px_rgba(139,92,246,0.2)] transition-colors hover:border-violet-400/50 hover:from-violet-500/30"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
            Слушать / Smart Link
          </button>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className={cfg.ledClass} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
          {cfg.label}
        </span>
      </div>
    </motion.div>
  );
}
