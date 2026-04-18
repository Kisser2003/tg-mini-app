"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Disc3, Plus, RefreshCw, Wallet, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { HeroWave } from "@/components/HeroWave";
import { PullRefreshBrand } from "@/components/PullRefreshBrand";
import { ReleaseCard, type ReleaseStatus } from "@/components/ReleaseCard";
import { SoundwaveVisualizer } from "@/components/SoundwaveVisualizer";
import { StatsTile } from "@/components/StatsTile";
import { LibraryReleaseSkeletonGrid, LibraryStatsSkeletonRow } from "@/components/ui/LibrarySkeleton";
import { resumeDraftFromRelease } from "@/features/release/createRelease/actions";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import { getReleaseStatusMeta, normalizeReleaseStatus } from "@/lib/release-status";
import { getReleaseDisplayTitle } from "@/repositories/releases.repo";
import { useReleases, type ReleaseListRow } from "@/lib/hooks/useReleases";
import { hapticMap } from "@/lib/haptic-map";
import { toast } from "sonner";
import { AuthGuard } from "@/components/AuthGuard";
import { useIsTelegramMiniApp } from "@/lib/hooks/useIsTelegramMiniApp";
import { pickProfileGreetingName, useAuthProfile } from "@/lib/hooks/useAuthProfile";
import { LibraryWebAside } from "@/components/library/LibraryWebAside";
import { cn } from "@/lib/utils";

type LibraryStatusFilter = "all" | "processing" | "ready" | "failed";

const STATUS_FILTER_CHIPS: { id: LibraryStatusFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "processing", label: "В проверке" },
  { id: "ready", label: "Отгружено" },
  { id: "failed", label: "Отклонены" }
];

function mapToReleaseCardStatus(canonical: ReturnType<typeof normalizeReleaseStatus>): ReleaseStatus {
  switch (canonical) {
    case "processing":
      return "processing";
    case "ready":
      return "ready";
    case "failed":
      return "error";
    case "draft":
    case "pending":
    case "unknown":
    default:
      return "draft";
  }
}

function LibraryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTelegram = useIsTelegramMiniApp();
  const {
    userId,
    authReady,
    authMode,
    telegramUser: user,
    greetingName,
    releases,
    releaseStats,
    data,
    error,
    isLoading,
    isValidating,
    mutate
  } = useReleases();

  const { data: authProfile } = useAuthProfile(
    Boolean(authReady && authMode === "web"),
    authMode === "web" ? userId : null
  );

  const showWebAside = !isTelegram;

  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LibraryStatusFilter>("all");
  const [adminNotesModal, setAdminNotesModal] = useState<{ title: string; body: string } | null>(
    null
  );

  useEffect(() => {
    if (searchParams.get("fromCreate") !== "1") return;
    void mutate(undefined, { revalidate: true });
    router.replace("/library");
  }, [searchParams, mutate, router]);

  /** После отправки релиза / входа на экран — перезапрос списка (SWR + RLS user id из стора). */
  useEffect(() => {
    if (userId == null) return;
    void mutate(undefined, { revalidate: true });
  }, [userId, mutate]);

  const filteredReleases = useMemo(() => {
    if (statusFilter === "all") return releases;
    return releases.filter((r) => normalizeReleaseStatus(r.status) === statusFilter);
  }, [releases, statusFilter]);

  const handleCreate = useCallback(() => {
    hapticMap.impactLight();
    router.push("/create/metadata");
  }, [router]);

  const handleResumeDraft = useCallback(
    async (release: ReleaseListRow) => {
      hapticMap.impactLight();
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

  const hasReleases = releases.length > 0;
  /** Нет контекста пользователя (сессия / Telegram) или ещё не инициализировали */
  const showAuthWait = !authReady || userId === null;
  const showListSkeleton =
    authReady && userId != null && isLoading && data === undefined;
  const showEmptyState =
    authReady &&
    userId != null &&
    !isLoading &&
    !showListSkeleton &&
    (error != null || releases.length === 0);

  const displayStats =
    error != null ? { ready: 0, processing: 0, failed: 0 } : releaseStats;

  const artistFirstName = pickProfileGreetingName(authProfile ?? undefined, greetingName);

  const isEmpty = !showAuthWait && !showListSkeleton && !error && releases.length === 0;

  const renderReleaseBlock = (release: ReleaseListRow, listIndex: number) => {
    const displayTitle = getReleaseDisplayTitle(release);
    const normalized = normalizeReleaseStatus(release.status);
    const cardStatus = mapToReleaseCardStatus(normalized);
    const statusMeta = getReleaseStatusMeta(release.status);
    const isDraft = normalized === "draft" || normalized === "pending";
    const isFailed = normalized === "failed";
    const isResumingDraft = isDraft && resumingId === release.id;
    const artistLine =
      release.track_name?.trim() && release.track_name.trim() !== displayTitle
        ? release.track_name.trim()
        : new Date(release.created_at).toLocaleDateString("ru-RU");

    const hasErrorText = Boolean(release.error_message?.trim());
    const effectiveErrorText = hasErrorText
      ? release.error_message!
      : "Причина ошибки не указана";
    const isExpanded = expandedErrorId === release.id;

    const onCardClick = () => {
      if (isResumingDraft) return;
      if (isDraft) {
        void handleResumeDraft(release);
        return;
      }
      if (isFailed) {
        hapticMap.notificationError();
        setExpandedErrorId((prev) => (prev === release.id ? null : release.id));
        return;
      }
      hapticMap.impactLight();
      router.push(`/release/${release.id}`);
    };

    if (isFailed) {
      return (
        <div key={release.id} className="space-y-2">
          <div className={isResumingDraft ? "pointer-events-none opacity-70" : ""}>
            <ReleaseCard
              title={displayTitle}
              artist={artistLine}
              status="error"
              coverUrl={release.artwork_url ?? undefined}
              index={listIndex}
              onClick={onCardClick}
            />
          </div>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-red-400/80"
              >
                {effectiveErrorText}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex flex-wrap items-center justify-end gap-2 px-1">
            <button
              type="button"
              className="text-[11px] font-medium text-white/50 underline-offset-2 hover:text-white/75"
              onClick={() => {
                hapticMap.impactLight();
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
              Комментарий модератора
            </button>
            <button
              type="button"
              className="text-[11px] font-medium text-red-300 underline underline-offset-2"
              onClick={() => {
                hapticMap.impactLight();
                router.push(`/create/metadata?from=failed&releaseId=${release.id}`);
              }}
            >
              Исправить
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={release.id} className={isResumingDraft ? "pointer-events-none opacity-70" : ""}>
        <ReleaseCard
          title={displayTitle}
          artist={
            isDraft && release.draft_upload_started
              ? `${artistLine} · черновик`
              : isDraft
                ? artistLine
                : `${artistLine} · ${statusMeta.label}`
          }
          status={cardStatus}
          coverUrl={release.artwork_url ?? undefined}
          index={listIndex}
          onClick={onCardClick}
        />
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] text-foreground">
      <PullRefreshBrand />

      <div
        className={cn(
          "mx-auto w-full px-5 pb-44 pt-14",
          showWebAside ? "max-w-[1200px]" : "max-w-lg"
        )}
      >
        <div
          className={cn(
            showWebAside &&
              "xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] xl:items-start xl:gap-10"
          )}
        >
          <div className={cn("min-w-0", showWebAside ? "xl:max-w-none" : "mx-auto w-full max-w-lg")}>
        {/* Hero — действия в правом верхнем углу карточки */}
        <motion.div
          className="glass-glow glass-glow-charged relative mb-12 min-h-[140px] overflow-hidden p-8 pr-24 sm:pr-28"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute right-4 top-4 z-20 flex gap-2 sm:right-6 sm:top-6">
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                hapticMap.impactLight();
                void mutate(undefined, { revalidate: true });
              }}
              disabled={isValidating || showAuthWait}
              aria-label="Обновить список"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.06] text-white/80 backdrop-blur-md transition-colors hover:bg-white/[0.1] hover:text-white disabled:opacity-40"
            >
              <RefreshCw className={`h-[18px] w-[18px] ${isValidating ? "animate-spin" : ""}`} />
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={handleCreate}
              aria-label="Новый релиз"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white pulse-glow"
              style={{
                background: "linear-gradient(135deg, #818cf8, #c084fc)",
                boxShadow: "0 0 20px rgba(129,140,248,0.25)"
              }}
            >
              <Plus className="h-[22px] w-[22px]" strokeWidth={2.5} />
            </motion.button>
          </div>
          <HeroWave />
          <div className="relative z-10 max-w-xl">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">
              С возвращением
            </p>
            <h1 className="font-display text-4xl font-extrabold leading-none tracking-tighter gradient-text">
              Привет, {artistFirstName}
            </h1>
            <p className="mt-3 max-w-[320px] text-sm font-light leading-relaxed text-white/30">
              Твой хаб дистрибуции: релизы и роялти в одном месте.
            </p>
          </div>
        </motion.div>

        {showAuthWait || showListSkeleton ? (
          <div className="glass-glow glass-glow-charged mb-12 px-4 py-5">
            <LibraryStatsSkeletonRow />
          </div>
        ) : (
          <div className="mb-12 flex gap-3">
            <StatsTile
              icon={Disc3}
              label="Всего"
              value={releases.length}
              delay={0.15}
              accentClass="gradient-text-blue"
            />
            <StatsTile
              icon={Clock}
              label="В проверке"
              value={displayStats.processing}
              delay={0.25}
              accentClass="gradient-text-teal"
            />
            <StatsTile
              icon={Wallet}
              label="Отгружено"
              value={displayStats.ready}
              delay={0.35}
              accentClass="gradient-text-gold"
            />
          </div>
        )}

        {showAuthWait || showListSkeleton ? (
          <div className="glass-glow glass-glow-charged space-y-4 px-4 py-5">
            <p className="text-[13px] text-white/45">
              {!authReady
                ? "Загрузка…"
                : userId === null
                  ? "Подключаем Telegram…"
                  : "Загружаем твои релизы…"}
            </p>
            <LibraryReleaseSkeletonGrid count={6} />
          </div>
        ) : showEmptyState && error != null ? (
          <motion.div
            className="glass-glow glass-glow-charged flex flex-col items-center p-10 text-center"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="font-display text-lg font-bold text-white/85">Не удалось загрузить</p>
            <p className="mt-2 text-sm text-white/35">
              {error instanceof Error ? error.message : String(error)}
            </p>
            <motion.button
              type="button"
              className="mt-6 rounded-xl px-6 py-3 text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #818cf8, #c084fc)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => void mutate(undefined, { revalidate: true })}
            >
              Повторить
            </motion.button>
          </motion.div>
        ) : isEmpty ? (
          <motion.div
            className="glass-glow glass-glow-charged flex flex-col items-center p-12 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <motion.div
              className="mb-8 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 35% 35%, rgba(129,140,248,0.15), rgba(76,29,149,0.08) 50%, rgba(3,3,3,0.6))",
                boxShadow: "0 0 60px rgba(129,140,248,0.1), inset 0 0 40px rgba(0,0,0,0.3)",
                border: "0.5px solid rgba(129,140,248,0.15)"
              }}
              animate={{ scale: [1, 1.04, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <SoundwaveVisualizer className="h-[4.5rem] w-[5.75rem] max-w-[90%] scale-95" />
            </motion.div>
            <p className="mb-2 font-display text-xl font-bold tracking-tight text-white/80">
              Пока нет релизов
            </p>
            <p className="mb-8 max-w-[220px] text-sm font-light text-white/25">
              Загрузите первый трек — это займёт пару минут.
            </p>
            <motion.button
              type="button"
              onClick={handleCreate}
              className="rounded-xl px-8 py-3.5 text-sm font-bold text-white pulse-glow"
              style={{ background: "linear-gradient(135deg, #818cf8, #c084fc)" }}
              whileTap={{ scale: 0.95 }}
            >
              Создать первый
            </motion.button>
          </motion.div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold tracking-tight text-white/70">
                Ваши релизы
              </h2>
              <span className="text-[10px] font-medium tracking-wider text-white/20">
                {filteredReleases.length} из {releases.length}
              </span>
            </div>

            {hasReleases && error == null && (
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {STATUS_FILTER_CHIPS.map((chip) => {
                  const active = statusFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => {
                        hapticMap.impactLight();
                        setStatusFilter(chip.id);
                      }}
                      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                        active
                          ? "border-[#818cf8]/50 bg-[#818cf8]/15 text-white"
                          : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredReleases.length === 0 && (
              <p className="mb-6 text-center text-[13px] text-white/45">
                Нет релизов с выбранным статусом.
              </p>
            )}

            <div className="flex flex-col gap-3">
              {filteredReleases.map((release, i) => renderReleaseBlock(release, i))}
            </div>
          </>
        )}
          </div>

          {showWebAside ? (
            <aside className="mt-10 min-w-0 xl:mt-0">
              <div className="xl:sticky xl:top-24">
                <LibraryWebAside />
              </div>
            </aside>
          ) : null}
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
              className="w-full max-w-[400px] rounded-[22px] border border-white/[0.1] bg-[#141416]/95 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 id="admin-notes-title" className="text-[15px] font-semibold text-white">
                  Комментарий модератора
                </h2>
                <button
                  type="button"
                  className="rounded-full p-1 text-white/45 hover:bg-white/10 hover:text-white/80"
                  aria-label="Закрыть"
                  onClick={() => setAdminNotesModal(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-white/88">
                {adminNotesModal.body}
              </p>
              <p className="mt-3 truncate text-[11px] text-white/40" title={adminNotesModal.title}>
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
    <AuthGuard>
      <Suspense
        fallback={
          <div className="min-h-[100dvh] px-5 pt-14 pb-44">
            <div className="mx-auto max-w-lg space-y-6">
              <div className="h-36 animate-pulse rounded-[1.25rem] bg-white/[0.06]" />
              <LibraryStatsSkeletonRow />
              <LibraryReleaseSkeletonGrid count={5} />
            </div>
          </div>
        }
      >
        <LibraryPageInner />
      </Suspense>
    </AuthGuard>
  );
}
