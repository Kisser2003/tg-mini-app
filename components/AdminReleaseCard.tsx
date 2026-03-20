"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, ExternalLink, Headphones, XCircle } from "lucide-react";
import { AudioPlayer } from "@/components/AudioPlayer";
import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases.repo";
import { getReleaseStatusMeta } from "@/lib/release-status";
import { Badge } from "@/components/Badge";

function releaseTypeLabel(type: ReleaseRecord["release_type"]): string {
  if (type === "single") return "Single";
  if (type === "ep") return "EP";
  return "Album";
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
  index: number;
  busy: boolean;
  rejectExpanded: boolean;
  rejectReason: string;
  onApprove: () => void;
  onToggleReject: () => void;
  onRejectReasonChange: (value: string) => void;
  onCancelReject: () => void;
  onConfirmReject: () => void;
  /** Ссылка на страницу детали модерации */
  detailHref?: string;
};

export function AdminReleaseCard({
  release,
  tracks,
  index,
  busy,
  rejectExpanded,
  rejectReason,
  onApprove,
  onToggleReject,
  onRejectReasonChange,
  onCancelReject,
  onConfirmReject,
  detailHref
}: AdminReleaseCardProps) {
  const statusMeta = getReleaseStatusMeta(release.status);
  const audioItems = buildAudioItems(release, tracks);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 0.995 }}
      whileTap={{ scale: 0.98 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 280, damping: 24 }}
      className="glass-card overflow-hidden rounded-[22px] border border-white/[0.08] bg-surface/80 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
    >
      <div className="flex gap-3">
        <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-inner">
          {release.artwork_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={release.artwork_url}
              alt={release.track_name}
              className="h-full w-full object-cover"
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
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Badge className="border-emerald-400/25 bg-emerald-500/10 text-emerald-100/90">
              {releaseTypeLabel(release.release_type)}
            </Badge>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] ${statusMeta.badgeClassName}`}>
              {statusMeta.label}
            </span>
          </div>
          <p className="text-[11px] text-white/45">
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
            Аудио недоступно (нет URL в базе).
          </p>
        ) : (
          <div className="space-y-2">
            {audioItems.map((item) => (
              <AudioPlayer key={item.key} src={item.src} label={item.label} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <motion.button
          type="button"
          disabled={busy}
          onClick={onApprove}
          whileHover={{ scale: 0.99 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-3 py-2.5 text-sm text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.35)] disabled:opacity-60"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Одобрить
        </motion.button>
        <motion.button
          type="button"
          disabled={busy}
          onClick={onToggleReject}
          whileHover={{ scale: 0.99 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/40 bg-rose-500/20 px-3 py-2.5 text-sm text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.35)] disabled:opacity-60"
        >
          <XCircle className="h-4 w-4 shrink-0" />
          Отклонить
        </motion.button>
      </div>

      {rejectExpanded && (
        <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/25 p-3 backdrop-blur-md">
          <p className="text-xs text-white/65">Причина отклонения (увидит артист)</p>
          <textarea
            value={rejectReason}
            onChange={(e) => onRejectReasonChange(e.target.value)}
            rows={3}
            placeholder="Например: проблема с правами, невалидная обложка, шум в WAV."
            className="w-full resize-none rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-[16px] leading-relaxed text-white placeholder:text-white/35"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancelReject}
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirmReject}
              className="rounded-lg border border-rose-300/35 bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 disabled:opacity-60"
            >
              Подтвердить отклонение
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
