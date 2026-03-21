"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { CheckCircle2, ExternalLink, Headphones, XCircle } from "lucide-react";
import { ArtworkCoverGlow } from "@/components/ArtworkCoverGlow";
import { AudioPlayerLazy } from "@/components/AudioPlayerLazy";
import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases.repo";
import { getReleaseStatusMeta } from "@/lib/release-status";
import { Badge } from "@/components/Badge";
import { triggerHaptic } from "@/lib/telegram";

function releaseTypeLabel(type: ReleaseRecord["release_type"]): string {
  if (type === "single") return "Сингл";
  if (type === "ep") return "EP";
  return "Альбом";
}

function buildAudioItems(release: ReleaseRecord, tracks: ReleaseTrackRow[]) {
  if (tracks.length > 0) {
    return tracks
      .filter((t) => t.audio_url && t.audio_url.length > 0)
      .map((t, i) => ({
        key: `${t.index}-${i}`,
        label: t.title.trim() || `Трек ${t.index + 1}`,
        src: t.audio_url as string
      }));
  }
  if (release.audio_url) {
    return [
      {
        key: "main",
        label: release.track_name || "Трек",
        src: release.audio_url
      }
    ];
  }
  return [];
}

type AdminReleaseCardProps = {
  release: ReleaseRecord;
  tracks: ReleaseTrackRow[];
  /** Индекс в списке (приоритет обложки для первых карточек). */
  index: number;
  /** Варианты для stagger-анимации очереди (родитель задаёт staggerChildren). */
  listVariants?: Variants;
  busy: boolean;
  onApprove: () => void;
  /** Открыть модальное окно выбора причины отклонения */
  onOpenReject: () => void;
  /** Ссылка на страницу детали модерации */
  detailHref?: string;
  /** LCP / приоритет загрузки для первых карточек в списке */
  artworkPriority?: boolean;
};

const ARTWORK_SIZES = "(max-width: 768px) 100vw, 33vw";

export function AdminReleaseCard({
  release,
  tracks,
  index: _index,
  listVariants,
  busy,
  onApprove,
  onOpenReject,
  detailHref,
  artworkPriority = false
}: AdminReleaseCardProps) {
  const statusMeta = getReleaseStatusMeta(release.status);
  const audioItems = buildAudioItems(release, tracks);

  return (
    <ArtworkCoverGlow
      artworkUrl={release.artwork_url}
      priority={artworkPriority}
      className="rounded-[22px]"
    >
    <motion.div
      {...(listVariants
        ? { variants: listVariants }
        : {
            initial: { opacity: 0, y: 8 },
            animate: { opacity: 1, y: 0 }
          })}
      whileHover={{ scale: 0.995 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="glass-card will-change-transform overflow-hidden rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl transition-shadow duration-300 hover:shadow-[0_0_48px_rgba(255,255,255,0.07),0_18px_40px_rgba(0,0,0,0.7)] focus-within:shadow-[0_0_52px_rgba(139,92,246,0.15),0_18px_40px_rgba(0,0,0,0.7)]"
    >
      <div className="flex gap-3">
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-inner">
          {release.artwork_url ? (
            <Image
              src={release.artwork_url}
              alt={release.track_name}
              fill
              sizes={ARTWORK_SIZES}
              className="object-cover"
              priority={artworkPriority}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-white/45">
              —
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[15px] font-semibold leading-tight">{release.track_name}</p>
            {detailHref && (
              <Link
                href={detailHref}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-white/70 hover:bg-white/10"
              >
                <ExternalLink className="h-3 w-3" />
                Карточка
              </Link>
            )}
          </div>
          <p className="truncate text-[13px] text-white/60">{release.artist_name}</p>
          <div className="flex min-w-0 flex-wrap items-center gap-2 pt-0.5">
            <Badge className="shrink-0 border-emerald-400/25 bg-emerald-500/10 text-emerald-100/90">
              {releaseTypeLabel(release.release_type)}
            </Badge>
            <span
              className={`inline-flex min-w-0 max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] ${statusMeta.badgeClassName} ${statusMeta.badgeGlowClassName ?? ""} ${statusMeta.badgeShimmerClassName ?? ""}`}
            >
              {statusMeta.label}
            </span>
          </div>
          <p className="truncate text-[11px] text-white/45" title={release.genre ?? undefined}>
            Отправлено:{" "}
            {new Date(release.created_at).toLocaleString("ru-RU", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })}
            {release.genre ? ` · ${release.genre}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
          <Headphones className="h-3.5 w-3.5" />
          Прослушать
        </div>
        {audioItems.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-white/50">
            Аудио пока недоступно для прослушивания.
          </p>
        ) : (
          <div className="space-y-2">
            {audioItems.map((item) => (
              <AudioPlayerLazy key={item.key} src={item.src} label={item.label} variant="admin" />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <motion.button
          type="button"
          disabled={busy}
          onClick={() => {
            triggerHaptic("light");
            onApprove();
          }}
          whileHover={{ scale: 0.99 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-3 py-2.5 text-sm font-medium text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.35)] disabled:opacity-60"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Одобрить
        </motion.button>
        <motion.button
          type="button"
          disabled={busy}
          onClick={() => {
            triggerHaptic("light");
            onOpenReject();
          }}
          whileHover={{ scale: 0.99 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/40 bg-rose-500/20 px-3 py-2.5 text-sm font-medium text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.35)] disabled:opacity-60"
        >
          <XCircle className="h-4 w-4 shrink-0" />
          Отклонить
        </motion.button>
      </div>
    </motion.div>
    </ArtworkCoverGlow>
  );
}
