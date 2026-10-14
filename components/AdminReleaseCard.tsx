"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import type { Variants } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
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
import { describeHistoryDecision, describePreviousRejection } from "@/lib/rejection-reasons";
import { pluralRu } from "@/lib/release-next-step";
import { describePayment, type PaymentTone } from "@/lib/release-payment";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<CanonicalReleaseStatus, string> = {
  draft: "черновик",
  pending: "не отправлен",
  processing: "на проверке",
  ready: "принят",
  failed: "отклонён",
  unknown: "статус не определён"
};

function statusTextClass(status: CanonicalReleaseStatus): string {
  if (status === "processing") return "text-omf-yellow";
  if (status === "ready") return "text-omf-green";
  if (status === "failed") return "text-omf-red";
  return "text-omf-graphite";
}

const PAYMENT_TONE_CLASS: Record<PaymentTone, string> = {
  done: "text-omf-green",
  wait: "text-omf-yellow",
  problem: "text-omf-red",
  muted: "text-omf-faint"
};

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
  /** Показать кнопки «Принять» / «Вернуть» (очередь). В истории — false. */
  showModerationActions?: boolean;
  /** Показать встроенный блок прослушивания на карточке списка. */
  showAudioPreview?: boolean;
  /** Режим выбора в очереди: тап по карточке отмечает её, кнопки решения и переход скрыты. */
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
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
  showAudioPreview = true,
  selectMode = false,
  selected = false,
  onToggleSelect
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
  const payment = describePayment(release.payment_status);
  const previousRejection = showModerationActions ? describePreviousRejection(release) : null;
  /** В истории: почему вернули / какая ссылка ушла артисту. */
  const decisionLine = showModerationActions ? null : describeHistoryDecision(release);
  const metaLine = [
    releaseTypeLabel(release.release_type),
    release.genre?.trim() || null,
    `${showModerationActions ? "отправлен" : "создан"} ${createdAtLabel}`
  ]
    .filter(Boolean)
    .join(" · ");

  const header = (
    <>
      <div className="relative w-[72px] shrink-0">
        <ReleaseSleeve
          seed={release.id}
          title={displayTitle}
          artist={release.artist_name}
          coverUrl={release.artwork_url}
          size="thumb"
          priority={artworkPriority}
        />
        {selectMode ? (
          <span
            className={cn(
              "absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
              selected ? "border-omf-bg bg-omf-ultra text-white" : "border-white/80 bg-black/40"
            )}
            aria-hidden
          >
            {selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-bold leading-tight tracking-[-0.02em]">
          {displayTitle}
        </p>
        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate text-[14px] text-omf-graphite">{release.artist_name}</p>
          {detailHref && !selectMode ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[13px] text-omf-ultra-text">
              Открыть
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          ) : null}
        </div>
        {featuringNames.length > 0 ? (
          <p className="truncate text-[13px] text-omf-graphite" title={featuringLabel}>
            feat. {featuringLabel}
          </p>
        ) : null}
        <p className="mt-1.5 text-[13px] text-omf-faint">{metaLine}</p>
        {decisionLine ? (
          <p className="mt-1.5 line-clamp-2 break-words text-[13px] leading-snug text-omf-graphite">
            {decisionLine}
          </p>
        ) : null}
        {previousRejection ? (
          <p className="mt-1.5 text-[13px] leading-snug">
            <span className="font-medium text-omf-yellow">
              Повторно
              {previousRejection.count > 1
                ? `, вернули ${previousRejection.count} ${pluralRu(previousRejection.count, ["раз", "раза", "раз"])}`
                : ""}
            </span>
            {previousRejection.summary ? (
              <span className="text-omf-graphite"> · проверь: {previousRejection.summary}</span>
            ) : null}
          </p>
        ) : null}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          <span className={statusTextClass(canonical)}>{STATUS_LABEL[canonical]}</span>
          <span className={PAYMENT_TONE_CLASS[payment.tone]}>{payment.label}</span>
          {hasError ? <span className="text-omf-red">есть ошибка</span> : null}
        </p>
      </div>
    </>
  );

  return (
    <article className="border-b border-omf-line py-5">
      {selectMode ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          onClick={() => {
            triggerHaptic("light");
            onToggleSelect?.();
          }}
          className={cn(
            "omf-focus -mx-2 -my-2 flex w-[calc(100%+1rem)] gap-3.5 rounded-[14px] p-2 text-left transition-colors",
            selected ? "bg-omf-surface" : "hover:bg-omf-surface"
          )}
        >
          {header}
        </button>
      ) : detailHref ? (
        <Link
          href={detailHref}
          className="omf-focus -mx-1 flex gap-3.5 rounded-[12px] px-1 transition-colors hover:bg-omf-surface"
        >
          {header}
        </Link>
      ) : (
        <div className="flex gap-3.5">{header}</div>
      )}

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

      {showModerationActions && !selectMode ? (
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
            Принять
          </button>
        </div>
      ) : null}
    </article>
  );
}

export const AdminReleaseCard = memo(AdminReleaseCardInner);
