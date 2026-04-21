"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Copy, ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";
import { openSmartLink } from "@/lib/open-smart-link";
import { hapticMap } from "@/lib/haptic-map";

export type MultiLinkReleaseRowProps = {
  releaseId: string;
  title: string;
  artist: string;
  smartLink: string;
  coverUrl?: string | null;
  index?: number;
};

/** Последний сегмент пути или hostname — для строки «короткий код» как у band.link. */
function shortLinkLabel(url: string): string {
  const t = url.trim();
  if (!t) return "—";
  try {
    const u = new URL(t);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
    return u.hostname.replace(/^www\./, "");
  } catch {
    return t.length > 40 ? `${t.slice(0, 37)}…` : t;
  }
}

function compactUrlForCard(url: string): string {
  const t = url.trim();
  try {
    const u = new URL(t);
    const path = u.pathname.replace(/\/$/, "");
    const tail = path && path !== "/" ? path : "";
    return `${u.hostname.replace(/^www\./, "")}${tail}`;
  } catch {
    return t.length > 48 ? `${t.slice(0, 45)}…` : t;
  }
}

export function MultiLinkReleaseRow({
  releaseId,
  title,
  artist,
  smartLink,
  coverUrl,
  index = 0
}: MultiLinkReleaseRowProps) {
  const short = shortLinkLabel(smartLink);
  const lineUrl = compactUrlForCard(smartLink);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(smartLink.trim());
      hapticMap.notificationSuccess();
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="glass-glow glass-glow-charged flex flex-col gap-4 rounded-[1.25rem] p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30 shadow-md sm:h-[80px] sm:w-[80px]">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={`Обложка: ${title}`}
              fill
              className="object-cover"
              sizes="80px"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-medium uppercase tracking-wider text-white/40">
              —
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white/95">{title}</p>
          <p className="mt-0.5 truncate text-[14px] text-white/65">{artist}</p>
          <p className="mt-1.5 truncate font-mono text-[12px] text-violet-300/90" title={smartLink}>
            {lineUrl}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 border-t border-white/[0.06] pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5 md:max-w-[240px]">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-500/15 text-pink-300"
            aria-hidden
          >
            <span className="text-[11px] font-bold leading-none">BL</span>
          </span>
          <div className="min-w-0 text-[12px]">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">
              Статус релиза
            </p>
            <p className="mt-0.5 font-medium text-emerald-300/95">Активен</p>
          </div>
        </div>
        <div className="text-[12px]">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">
            Короткая ссылка
          </p>
          <p className="mt-0.5 truncate font-mono text-[13px] text-white/88" title={short}>
            {short}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            hapticMap.impactLight();
            openSmartLink(smartLink);
          }}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366f1]/90 to-[#a855f7]/90 px-4 text-[13px] font-semibold text-white shadow-lg shadow-violet-500/10 ring-1 ring-white/10 sm:flex-none sm:min-w-[140px]"
        >
          <ExternalLink className="h-4 w-4 opacity-90" />
          Открыть
        </motion.button>
        <div className="flex gap-2 sm:w-full">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => void copy()}
            aria-label="Копировать ссылку"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/10"
          >
            <Copy className="h-4 w-4" />
          </motion.button>
          <Link
            href={`/release/${releaseId}`}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/10"
            aria-label="Карточка релиза"
            onClick={() => hapticMap.impactLight()}
          >
            <Pencil className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
