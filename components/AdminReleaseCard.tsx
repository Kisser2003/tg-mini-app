"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import type { Variants } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { ReleaseSleeve } from "@/components/ReleaseSleeve";
import { AudioPlayerLazy } from "@/components/AudioPlayerLazy";
import {
  getReleaseDisplayTitle,
  type ReleaseRecord,
  type ReleaseTrackRow
} from "@/repositories/releases.repo";
import { normalizeReleaseStatus, type CanonicalReleaseStatus } from "@/lib/release-status";
import { triggerHaptic } from "@/lib/telegram";
import { featuringNamesFromCollaboratorsJson } from "@/lib/collaborators";

const STATUS_LABEL: Record<CanonicalReleaseStatus, string> = {
  draft: "черновик",
  pending: "не отправлен",
  processing: "на проверке",
  ready: "одобрен",
  failed: "отклонён",
  unknown: "статус не определён"
};

function statusTextClass(status: CanonicalReleaseStatus): string {
  if (status === "processing") return "text-omf-yellow";
  if (status === "ready") return "text-omf-green";
  if (status === "failed") return "text-omf-red";
  return "text-omf-graphite";
}

function releaseTypeLabel(type: ReleaseRecord["release_type"]): string {
  if (type === "single") return "Сингл";
  if (type === "ep") return "EP";
  return "Альбом";
}

function buildAudioItems(release: ReleaseRecord, tracks: ReleaseTrackRow[]) {
  if (tracks.length > 0) {
    return tracks
      .filter((t) => t.file_path && t.file_path.length > 0)
      .map((t, i) => ({
        key: `${t.index}-${i}`,
        label: t.title.trim() || `Трек ${t.index + 1}`,
        src: t.file_path as string
      }));
  }
  if (release.audio_url) {
    return [
      {
        key: "main",
        label: getReleaseDisplayTitle(release) || "Трек",
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
  onOpenApprove: () => void;
  /** Открыть модальное окно выбора причины отклонения */
  onOpenReject: () => void;
  /** Ссылка на страницу детали модерации */
  detailHref?: string;
  /** LCP / приоритет загрузки для первых карточек в списке */
  artworkPriority?: boolean;
  /** Показать кнопки «Одобрить» / «Отклонить» (очередь). В истории — false. */
  showModerationActions?: boolean;
  /** Показать встроенный блок прослушивания на карточке списка. */
  showAudioPreview?: boolean;
};


function AdminReleaseCardInner({
  release,
  tracks,
  index: _index,
  listVariants: _listVariants,
  busy,
  onOpenApprove,
  onOpenReject,
  detailHref,
  artworkPriority = false,
  showModerationActions = true,
  showAudioPreview = true
}: AdminReleaseCardProps) {
  const canonical = normalizeReleaseStatus(release.status);
  const displayTitle = getReleaseDisplayTitle(release);
  const audioItems = useMemo(() => buildAudioItems(release, tracks), [release, tracks]);
  const featuringNames = useMemo(
    () => featuringNamesFromCollaboratorsJson(release.collaborators),
    [release.collaborators]
  );
  const featuringLabel = useMemo(() => featuringNames.join(", "), [featuringNames]);
  const createdAtLabel = useMemo(
    () =>
      new Date(release.created_at).toLocaleString("ru-RU", {
        day: "numeric",
        month: "short"
      }),
    [release.created_at]
  );
  const hasError = (release.error_message ?? "").trim().length > 0;
  const noSmartLink = showModerationActions && (release.smart_link ?? "").trim().length === 0;
  const metaLine = [
    releaseTypeLabel(release.release_type),
    release.genre?.trim() || null,
    `${showModerationActions ? "отправлен" : "создан"} ${createdAtLabel}`
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="border-b border-omf-line py-5">
      <div className="flex gap-3.5">
        <div className="w-[72px] shrink-0">
          <ReleaseSleeve
            seed={release.id}
            title={displayTitle}
            artist={release.artist_name}
            coverUrl={release.artwork_url}
            size="thumb"
            priority={artworkPriority}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[17px] font-bold leading-tight tracking-[-0.02em] ${showModerationActions ? "pr-9" : ""}`}>
            {displayTitle}
          </p>
          <div className={`mt-0.5 flex items-baseline justify-between gap-2 ${showModerationActions ? "pr-9" : ""}`}>
            <p className="min-w-0 truncate text-[14px] text-omf-graphite">{release.artist_name}</p>
            {detailHref ? (
              <Link
                href={detailHref}
                className="omf-focus inline-flex shrink-0 items-center gap-0.5 rounded-full text-[13px] text-omf-ultra-text hover:text-omf-ink"
              >
                Открыть
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : null}
          </div>
          {featuringNames.length > 0 ? (
            <p className="truncate text-[13px] text-omf-graphite" title={featuringLabel}>
              feat. {featuringLabel}
            </p>
          ) : null}
          <p className="mt-1.5 text-[13px] text-omf-faint">{metaLine}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <span className={statusTextClass(canonical)}>{STATUS_LABEL[canonical]}</span>
            {noSmartLink ? <span className="text-omf-yellow">нет ссылки на релиз</span> : null}
            {hasError ? <span className="text-omf-red">есть ошибка</span> : null}
          </p>
        </div>
      </div>

      {showAudioPreview ? (
        <div className="mt-4 space-y-2">
          {audioItems.length === 0 ? (
            <p className="text-[14px] text-omf-graphite">Аудио пока нет, послушать нечего.</p>
          ) : (
            audioItems.map((item) => (
              <AudioPlayerLazy key={item.key} src={item.src} label={item.label} variant="admin" />
            ))
          )}
        </div>
      ) : null}

      {showModerationActions ? (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              triggerHaptic("light");
              onOpenReject();
            }}
            className="omf-btn-secondary w-full disabled:opacity-50"
          >
            Вернуть
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              triggerHaptic("light");
              onOpenApprove();
            }}
            className="omf-btn-ink w-full disabled:opacity-50"
          >
            Одобрить
          </button>
        </div>
      ) : null}
    </article>
  );
}

export const AdminReleaseCard = memo(AdminReleaseCardInner);
