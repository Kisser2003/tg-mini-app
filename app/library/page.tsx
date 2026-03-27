"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent
} from "react";
import Image from "next/image";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { AlertCircle, Music, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ArtworkCoverGlow } from "@/components/ArtworkCoverGlow";
import { PullRefreshBrand } from "@/components/PullRefreshBrand";
import { LibraryReleaseSkeletonGrid, LibraryStatsSkeletonRow } from "@/components/ui/Skeleton";
import { resumeDraftFromRelease } from "@/features/release/createRelease/actions";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import {
  getReleaseStatusMeta,
  normalizeReleaseStatus,
  type CanonicalReleaseStatus,
  type ReleaseStatusMeta
} from "@/lib/release-status";
import { getMyReleases, getReleaseDisplayTitle, type ReleaseRecord } from "@/repositories/releases.repo";
import {
  getTelegramWebApp,
  getTelegramUserIdForSupabaseRequests,
  initTelegramWebApp,
  triggerHaptic,
  type TelegramUser
} from "@/lib/telegram";
import { USER_REQUEST_TIMEOUT_MESSAGE } from "@/lib/errors";
import { ARTWORK_BLUR_DATA_URL } from "@/lib/image-blur";
import { SWR_LIST_OPTIONS } from "@/lib/swr-config";
import { withRequestTimeout } from "@/lib/withRequestTimeout";
import { toast } from "sonner";
type ReleaseRow = Pick<
  ReleaseRecord,
  | "id"
  | "title"
  | "track_name"
  | "artwork_url"
  | "status"
  | "created_at"
  | "error_message"
  | "admin_notes"
  | "draft_upload_started"
  | "isrc"
>;

const ARTWORK_SIZES = "(max-width: 768px) 100vw, 33vw";
/** Список релизов + Supabase; не должен «висеть» бесконечно при сетевых сбоях. */
const RELEASES_LIST_TIMEOUT_MS = 15000;

type LibraryStatusFilter = "all" | "processing" | "ready" | "failed";

const STATUS_FILTER_CHIPS: { id: LibraryStatusFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "processing", label: "На модерации" },
  { id: "ready", label: "Готовы" },
  { id: "failed", label: "Отклонены" }
];

const releaseListContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1
  }
};

const releaseListItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: (typeof index === "number" ? index : 0) * 0.05,
      type: "spring",
      stiffness: 280,
      damping: 26
    }
  })
};

/** TWA Haptic: `window.Telegram.WebApp.HapticFeedback` */
function twaImpact(style: "light" | "medium"): void {
  if (typeof window === "undefined") return;
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style);
  } catch {
    /* ignore */
  }
}

const LIBRARY_BADGE_GLOW: Record<CanonicalReleaseStatus, string> = {
  draft: "shadow-[0_0_32px_-6px_rgba(161,161,170,0.55)]",
  pending: "shadow-[0_0_32px_-6px_rgba(139,92,246,0.5)]",
  processing: "",
  ready: "shadow-[0_0_32px_-6px_rgba(34,197,94,0.55)]",
  failed: "shadow-[0_0_32px_-6px_rgba(251,113,133,0.5)]",
  unknown: "shadow-[0_0_32px_-6px_rgba(14,165,233,0.45)]"
};

function LibraryStatusBadge({
  statusMeta,
  children,
  className = ""
}: {
  statusMeta: ReleaseStatusMeta;
  children: React.ReactNode;
  className?: string;
}) {
  const { canonical } = statusMeta;
  const glow = LIBRARY_BADGE_GLOW[canonical];
  const base = `${statusMeta.badgeClassName} ${statusMeta.badgeGlowClassName ?? ""} ${statusMeta.badgeShimmerClassName ?? ""} backdrop-blur-[10px] ${glow} ${className}`;

  if (canonical === "processing") {
    return (
      <motion.span
        className={base}
        animate={{
          boxShadow: [
            "0 0 28px rgba(245,158,11,0.3)",
            "0 0 48px rgba(245,158,11,0.7)",
            "0 0 28px rgba(245,158,11,0.3)"
          ]
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {children}
      </motion.span>
    );
  }
  return <span className={base}>{children}</span>;
}

function ArtworkThumb({
  url,
  title,
  priority = false
}: {
  url: string | null;
  title: string;
  priority?: boolean;
}) {
  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
      {url ? (
        <Image
          src={url}
          alt={title}
          fill
          sizes={ARTWORK_SIZES}
          className="object-cover"
          priority={priority}
          placeholder="blur"
          blurDataURL={ARTWORK_BLUR_DATA_URL}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-white/50">
          Нет обложки
        </div>
      )}
    </div>
  );
}

async function fetchReleasesForUser([, uid]: readonly ["releases", string]): Promise<ReleaseRow[]> {
  const queryPromise = getMyReleases(uid);

  const rows = await withRequestTimeout(
    queryPromise,
    RELEASES_LIST_TIMEOUT_MS,
    USER_REQUEST_TIMEOUT_MESSAGE
  );
  return rows as ReleaseRow[];
}

function LibraryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  /** Временно: сравнение Telegram UID ПК vs мобилка (склейка auth по telegram_id). */
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LibraryStatusFilter>("all");
  const [adminNotesModal, setAdminNotesModal] = useState<{
    title: string;
    body: string;
  } | null>(null);

  useEffect(() => {
    initTelegramWebApp();
    setUser(getTelegramWebApp()?.initDataUnsafe?.user ?? null);
    const tid = getTelegramUserIdForSupabaseRequests();
    setUserId(tid != null ? String(tid) : null);
  }, []);

  const swrKey = userId != null ? (["releases", userId] as const) : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    fetchReleasesForUser,
    {
      ...SWR_LIST_OPTIONS,
      refreshInterval: (latestData: ReleaseRow[] | undefined) =>
        latestData?.some((r) => normalizeReleaseStatus(r.status) === "processing") ? 7000 : 0,
      keepPreviousData: false
    }
  );

  const releases = useMemo(() => data ?? [], [data]);

  const filteredReleases = useMemo(() => {
    if (statusFilter === "all") return releases;
    return releases.filter((r) => normalizeReleaseStatus(r.status) === statusFilter);
  }, [releases, statusFilter]);

  useEffect(() => {
    if (searchParams.get("fromCreate") !== "1") return;
    void mutate(undefined, { revalidate: true });
    router.replace("/library");
  }, [searchParams, mutate, router]);

  const handleCreate = useCallback(() => {
    twaImpact("light");
    router.push("/create/metadata");
  }, [router]);

  const handleResumeDraft = useCallback(
    async (release: ReleaseRow) => {
      twaImpact("medium");
      setResumingId(release.id);
      try {
        const path = await resumeDraftFromRelease(release.id);
        if (!path) {
          const msg =
            useCreateReleaseDraftStore.getState().submitError ?? "Не удалось открыть черновик.";
          toast.error(msg);
          return;
        }
        router.push(path);
      } finally {
        setResumingId(null);
      }
    },
    [router]
  );

  const hasReleases = useMemo(() => releases.length > 0, [releases]);
  const releaseStats = useMemo(() => {
    return releases.reduce(
      (acc, release) => {
        const status = normalizeReleaseStatus(release.status);
        if (status === "ready") acc.ready += 1;
        else if (status === "processing") acc.processing += 1;
        else if (status === "failed") acc.failed += 1;
        return acc;
      },
      { ready: 0, processing: 0, failed: 0 }
    );
  }, [releases]);

  const showTelegramWait = userId === null;
  const showListSkeleton = userId != null && isLoading && data === undefined;

  const showEmptyState = useMemo(
    () =>
      userId != null &&
      !isLoading &&
      !showListSkeleton &&
      (error != null || releases.length === 0),
    [userId, isLoading, showListSkeleton, error, releases.length]
  );

  const displayStats = useMemo(
    () =>
      error != null
        ? { ready: 0, processing: 0, failed: 0 }
        : releaseStats,
    [error, releaseStats]
  );

  return (
    <div className="min-h-[100dvh] bg-background px-5 py-6 pb-10 text-text">
      <PullRefreshBrand />
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-6 font-sans">
        <div className="sticky top-0 z-40 -mx-5 border-b border-white/[0.06] bg-black/40 px-5 py-5 backdrop-blur-xl backdrop-saturate-150">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[20px] font-semibold tracking-tight">Мои релизы</h1>
              <p className="text-[10px] opacity-30">UID: {user?.id}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <motion.button
                type="button"
                whileHover={{ scale: 0.99 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                onClick={() => {
                  twaImpact("light");
                  void mutate(undefined, { revalidate: true });
                }}
                disabled={isValidating}
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 disabled:opacity-60"
              >
                {isValidating ? "Обновляем..." : "Обновить"}
              </motion.button>
              <button
                type="button"
                onClick={handleCreate}
                className="rounded-[16px] bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground shadow-md"
              >
                Новый релиз
              </button>
            </div>
          </div>
        </div>

        {hasReleases && error == null && (
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STATUS_FILTER_CHIPS.map((chip) => {
              const active = statusFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    twaImpact("light");
                    setStatusFilter(chip.id);
                  }}
                  className={`shrink-0 snap-start rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                    active
                      ? "border-primary/50 bg-primary/20 text-white"
                      : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        )}

        {showTelegramWait || showListSkeleton ? (
          <LibraryStatsSkeletonRow />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-[16px] border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
              <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-200/80">Готово</p>
              <p className="mt-1 text-lg font-semibold text-emerald-100">{displayStats.ready}</p>
            </div>
            <div className="rounded-[16px] border border-amber-500/30 bg-amber-500/10 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-amber-200/80">Проверка</p>
              <p className="mt-1 text-lg font-semibold text-amber-100">{displayStats.processing}</p>
            </div>
            <div className="rounded-[16px] border border-rose-500/30 bg-rose-500/10 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-rose-200/80">Ошибки</p>
              <p className="mt-1 text-lg font-semibold text-rose-100">{displayStats.failed}</p>
            </div>
          </div>
        )}

        <div className="mt-2 flex flex-col gap-4">
          <AnimatePresence mode="wait">
            {(showTelegramWait || showListSkeleton) && (
              <motion.div
                key="library-loading"
                className="space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-[13px] text-text-muted">
                  {showTelegramWait ? "Подключаем Telegram…" : "Загружаем твои релизы из OMF…"}
                </p>
                <LibraryReleaseSkeletonGrid count={6} />
              </motion.div>
            )}
          </AnimatePresence>

          {showEmptyState && (
            <div className="flex min-h-[52vh] flex-1 flex-col items-center justify-center px-2">
              <div className="flex w-full max-w-[360px] flex-col items-center justify-center gap-6 rounded-[24px] border border-white/[0.08] bg-surface/80 px-6 py-12 text-center shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
                <div className="relative mx-auto flex h-[88px] w-[88px] items-center justify-center">
                  <div
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/50 via-fuchsia-500/35 to-cyan-500/40 opacity-90 blur-2xl"
                    aria-hidden
                  />
                  <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-[22px] border border-white/20 bg-black/40 shadow-[0_12px_40px_rgba(139,92,246,0.35)] backdrop-blur-md">
                    <Music className="h-9 w-9 text-white" strokeWidth={1.35} aria-hidden />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[17px] font-semibold tracking-tight">У вас пока нет релизов</p>
                  <p className="text-[13px] text-text-muted">
                    Загрузите первый трек — это займёт пару минут.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="inline-flex h-[52px] w-full max-w-[280px] items-center justify-center rounded-[18px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[15px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.6)]"
                >
                  Создать первый
                </button>
              </div>
            </div>
          )}

          {userId != null &&
            hasReleases &&
            error == null &&
            filteredReleases.length === 0 && (
            <p className="text-center text-[13px] text-text-muted">
              Нет релизов с выбранным статусом. Смените фильтр выше.
            </p>
          )}

          {userId != null && error == null && hasReleases && filteredReleases.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
            <motion.div
              className="space-y-3"
              variants={releaseListContainer}
              initial="hidden"
              animate="show"
            >
              {filteredReleases.map((release, listIndex) => {
                  const displayTitle = getReleaseDisplayTitle(release);
                  const statusMeta = getReleaseStatusMeta(release.status);
                  const normalizedStatus = normalizeReleaseStatus(release.status);
                  const isDraft =
                    normalizedStatus === "draft" || normalizedStatus === "pending";
                  const isFailed = normalizedStatus === "failed";
                  const isResumingDraft = isDraft && resumingId === release.id;
                  const hasErrorText =
                    (release.error_message && release.error_message.trim().length > 0) || false;
                  const effectiveErrorText = hasErrorText
                    ? release.error_message!
                    : "Причина ошибки не указана";
                  const isExpanded = expandedErrorId === release.id;
                  const thumbPriority = listIndex < 2 && Boolean(release.artwork_url);

                  if (isDraft) {
                    return (
                      <motion.div
                        key={release.id}
                        variants={releaseListItem}
                        custom={listIndex}
                        className="library-release-row rounded-[20px]"
                      >
                        <ArtworkCoverGlow
                          artworkUrl={release.artwork_url}
                          priority={thumbPriority}
                          className="rounded-[20px] border border-white/[0.08] bg-surface/80 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
                        >
                          <motion.div
                            className={`flex w-full gap-3 px-4 py-4 ${
                              isResumingDraft ? "pointer-events-none opacity-70" : "cursor-pointer select-none"
                            }`}
                            role="button"
                            tabIndex={0}
                            aria-busy={isResumingDraft}
                            aria-label={`Продолжить заполнение черновика: ${displayTitle}`}
                            whileHover={isResumingDraft ? undefined : { scale: 1.01, opacity: 0.96 }}
                            whileTap={isResumingDraft ? undefined : { scale: 0.985 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            onClick={() => {
                              void handleResumeDraft(release);
                            }}
                            onKeyDown={(e: KeyboardEvent) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                void handleResumeDraft(release);
                              }
                            }}
                          >
                            <ArtworkThumb
                              url={release.artwork_url}
                              title={displayTitle}
                              priority={thumbPriority}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[15px] font-semibold">{displayTitle}</p>
                              <p className="mt-0.5 text-[11px] text-text-muted">
                                {new Date(release.created_at).toLocaleString("ru-RU", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </p>
                            </div>
                            <LibraryStatusBadge
                              statusMeta={statusMeta}
                              className="inline-flex max-w-[min(52%,200px)] shrink-0 items-center justify-center self-start rounded-full border px-3 py-1 text-center text-[10px] font-medium leading-tight"
                            >
                              {release.draft_upload_started
                                ? "Черновик (не завершено)"
                                : statusMeta.label}
                            </LibraryStatusBadge>
                          </motion.div>
                        </ArtworkCoverGlow>
                      </motion.div>
                    );
                  }

                  if (isFailed) {
                    return (
                      <motion.div
                        key={release.id}
                        variants={releaseListItem}
                        custom={listIndex}
                        className="library-release-row rounded-[20px]"
                        onClick={(e) => {
                          const el = e.target as HTMLElement;
                          if (el.closest("button")) return;
                          twaImpact("medium");
                        }}
                      >
                        <ArtworkCoverGlow
                          artworkUrl={release.artwork_url}
                          priority={thumbPriority}
                          className="rounded-[20px] border border-white/[0.08] bg-surface/80 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
                        >
                          <div className="px-4 py-4">
                        <div className="flex gap-3">
                          <ArtworkThumb
                            url={release.artwork_url}
                            title={displayTitle}
                            priority={thumbPriority}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold">{displayTitle}</p>
                            <p className="mt-0.5 text-[11px] text-text-muted">
                              {new Date(release.created_at).toLocaleString("ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-500/35 bg-rose-500/10 text-rose-200/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-colors hover:bg-rose-500/20"
                                aria-label="Комментарий модератора"
                                onClick={() => {
                                  triggerHaptic("light");
                                  const notes = release.admin_notes?.trim();
                                  setAdminNotesModal({
                                    title: displayTitle,
                                    body:
                                      notes && notes.length > 0
                                        ? notes
                                        : "Свяжитесь с поддержкой для уточнения деталей"
                                  });
                                }}
                              >
                                <AlertCircle className="h-[18px] w-[18px]" strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-full border-0 bg-transparent p-0"
                                onClick={() => {
                                  setExpandedErrorId((prev) =>
                                    prev === release.id ? null : release.id
                                  );
                                }}
                              >
                                <LibraryStatusBadge
                                  statusMeta={statusMeta}
                                  className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium"
                                >
                                  {statusMeta.label}
                                  <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[9px]">
                                    i
                                  </span>
                                </LibraryStatusBadge>
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                router.push(
                                  `/create/metadata?from=failed&releaseId=${release.id}`
                                );
                              }}
                              className="text-[11px] font-medium text-red-300 underline underline-offset-2"
                            >
                              Исправить
                            </button>
                          </div>
                        </div>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.18 }}
                              className="mt-3 rounded-[16px] border border-red-500/30 bg-red-950/40 px-3 py-2 text-[11px] font-mono leading-relaxed text-red-400/80 shadow-[0_14px_30px_rgba(0,0,0,0.7)] backdrop-blur-xl"
                            >
                              {effectiveErrorText}
                            </motion.div>
                          )}
                        </AnimatePresence>
                          </div>
                        </ArtworkCoverGlow>
                      </motion.div>
                    );
                  }

                  return (
                    <motion.div
                      key={release.id}
                      variants={releaseListItem}
                      custom={listIndex}
                      className="library-release-row rounded-[20px]"
                    >
                      <ArtworkCoverGlow
                        artworkUrl={release.artwork_url}
                        priority={thumbPriority}
                        className="rounded-[20px]"
                      >
                        <motion.button
                          type="button"
                          onClick={() => {
                            twaImpact("medium");
                            router.push(`/release/${release.id}`);
                          }}
                          whileHover={{ scale: 0.995 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          className="glass-card flex w-full items-center gap-3 p-4 text-left"
                        >
                          <ArtworkThumb
                            url={release.artwork_url}
                            title={displayTitle}
                            priority={thumbPriority}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{displayTitle}</p>
                            <p className="text-xs text-white/60">
                              {new Date(release.created_at).toLocaleDateString("ru-RU")}
                            </p>
                            {release.isrc && (
                              <p className="mt-0.5 font-mono text-[10px] text-white/35">
                                ISRC {release.isrc}
                              </p>
                            )}
                          </div>
                          <LibraryStatusBadge
                            statusMeta={statusMeta}
                            className="rounded-full border px-2 py-1 text-[10px]"
                          >
                            {statusMeta.label}
                          </LibraryStatusBadge>
                        </motion.button>
                      </ArtworkCoverGlow>
                    </motion.div>
                  );
                })}
            </motion.div>
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {adminNotesModal && (
          <motion.div
            key="admin-notes-modal"
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 backdrop-blur-[2px] sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAdminNotesModal(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-notes-title"
              className="w-full max-w-[400px] rounded-[22px] border border-white/[0.1] bg-surface/95 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 id="admin-notes-title" className="text-[15px] font-semibold leading-snug text-white">
                  Комментарий модератора
                </h2>
                <button
                  type="button"
                  className="rounded-full p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white/80"
                  aria-label="Закрыть"
                  onClick={() => setAdminNotesModal(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-white/88">
                {adminNotesModal.body}
              </p>
              <p className="mt-3 truncate text-[11px] text-text-muted" title={adminNotesModal.title}>
                {adminNotesModal.title}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-background px-5 py-6 pb-10 text-text">
          <div className="mx-auto flex w-full max-w-[440px] flex-col gap-6">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-white/[0.06]" aria-hidden />
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[72px] animate-pulse rounded-[16px] bg-white/[0.05]"
                  aria-hidden
                />
              ))}
            </div>
            <LibraryReleaseSkeletonGrid count={5} />
          </div>
        </div>
      }
    >
      <LibraryPageInner />
    </Suspense>
  );
}
