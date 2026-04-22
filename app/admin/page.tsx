"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { History, RefreshCcw } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";
import { AdminApproveSmartLinkModal } from "@/components/AdminApproveSmartLinkModal";
import { AdminRejectModal } from "@/components/AdminRejectModal";
import { ADMIN_REJECT_PRESETS } from "@/components/AdminRejectModal";
import { AdminReleaseCard } from "@/components/AdminReleaseCard";
import { PullRefreshBrand } from "@/components/PullRefreshBrand";
import { AdminModerationQueueSkeleton } from "@/components/ui/LibrarySkeleton";
import { publishReleaseWithSmartLink, rejectRelease } from "@/features/admin/actions";
import { fetchAdminModerationQueue } from "@/features/admin/moderation-queue";
import { isAdminUi, isAdminUiByWebSession } from "@/lib/admin";
import { debugInit } from "@/lib/debug";
import { fetchAdminStats } from "@/lib/fetch-admin-stats";
import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases.repo";
import { hapticMap } from "@/lib/haptic-map";
import { getTelegramUserId, initTelegramWebApp, triggerHaptic } from "@/lib/telegram";
import { errorToUserString, USER_REQUEST_TIMEOUT_MESSAGE } from "@/lib/errors";
import { SWR_LIST_OPTIONS } from "@/lib/swr-config";
import { withRequestTimeout } from "@/lib/withRequestTimeout";

type ModerationQueueRow = {
  release: ReleaseRecord;
  tracks: ReleaseTrackRow[];
};

type QueueFilterKey = "all" | "needs_smart_link" | "with_errors";

const ADMIN_QUEUE_TIMEOUT_MS = 15000;

const adminQueueContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const adminQueueItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 280, damping: 24 }
  }
};

export default function AdminPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectModalReleaseId, setRejectModalReleaseId] = useState<string | null>(null);
  const [approveModalReleaseId, setApproveModalReleaseId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminResolved, setAdminResolved] = useState(false);
  const [activeFilter, setActiveFilter] = useState<QueueFilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReleaseIds, setSelectedReleaseIds] = useState<string[]>([]);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    debugInit("admin", "init start");
    initTelegramWebApp();
    setUserId(getTelegramUserId());
    setIsAdmin(isAdminUi());
    void (async () => {
      const webAdmin = await isAdminUiByWebSession();
      setIsAdmin((prev) => prev || webAdmin);
      setAdminResolved(true);
    })();
    debugInit("admin", "init done");
  }, []);

  useEffect(() => {
    if (adminResolved && !isAdmin) {
      router.replace("/");
    }
  }, [adminResolved, isAdmin, router]);

  const swrKey = isAdmin ? (["admin-moderation-queue"] as const) : null;
  const statsKey = isAdmin ? (["admin-stats"] as const) : null;

  const loadQueueCore = useCallback(async (): Promise<ModerationQueueRow[]> => {
    return fetchAdminModerationQueue();
  }, []);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    () =>
      withRequestTimeout(
        loadQueueCore(),
        ADMIN_QUEUE_TIMEOUT_MS,
        USER_REQUEST_TIMEOUT_MESSAGE
      ),
    {
      ...SWR_LIST_OPTIONS,
      refreshInterval: 8000,
      keepPreviousData: true
    }
  );

  const {
    data: stats,
    error: statsError,
    mutate: mutateStats
  } = useSWR(statsKey, fetchAdminStats, {
    ...SWR_LIST_OPTIONS,
    refreshInterval: 15000
  });

  const moderationQueue = useMemo(() => data ?? [], [data]);
  const moderationQueueFilteredByPreset = useMemo(
    () =>
      moderationQueue.filter((row) => {
        const smartLink = (row.release.smart_link ?? "").trim();
        const hasSmartLink = smartLink.length > 0;
        const hasError = (row.release.error_message ?? "").trim().length > 0;

        if (activeFilter === "needs_smart_link") return !hasSmartLink;
        if (activeFilter === "with_errors") return hasError;
        return true;
      }),
    [moderationQueue, activeFilter]
  );
  const filterCounts: Record<QueueFilterKey, number> = {
    all: moderationQueue.length,
    needs_smart_link: moderationQueue.filter((row) => (row.release.smart_link ?? "").trim().length === 0).length,
    with_errors: moderationQueue.filter((row) => (row.release.error_message ?? "").trim().length > 0).length
  };
  const searchNeedle = searchQuery.trim().toLowerCase();
  const moderationQueueFiltered = useMemo(
    () =>
      moderationQueueFilteredByPreset.filter((row) => {
        if (!searchNeedle) return true;
        const id = row.release.id.toLowerCase();
        const artist = row.release.artist_name.toLowerCase();
        const title = (
          (typeof row.release.title === "string" && row.release.title.trim()) ||
          (typeof row.release.track_name === "string" && row.release.track_name.trim()) ||
          ""
        ).toLowerCase();
        const smartLink = (row.release.smart_link ?? "").toLowerCase();
        return (
          id.includes(searchNeedle) ||
          artist.includes(searchNeedle) ||
          title.includes(searchNeedle) ||
          smartLink.includes(searchNeedle)
        );
      }),
    [moderationQueueFilteredByPreset, searchNeedle]
  );
  const errorMessage = errorToUserString(error);
  const statsErrorMessage = errorToUserString(statsError);
  const selectedRows = moderationQueueFiltered.filter((row) =>
    selectedReleaseIds.includes(row.release.id)
  );
  const selectedWithSmartLinkCount = selectedRows.filter(
    (row) => (row.release.smart_link ?? "").trim().length > 0
  ).length;
  const selectedWithoutSmartLinkCount = selectedRows.length - selectedWithSmartLinkCount;

  const refreshAll = useCallback(async () => {
    await Promise.all([mutate(undefined, { revalidate: true }), mutateStats(undefined, { revalidate: true })]);
  }, [mutate, mutateStats]);

  useEffect(() => {
    setSelectedReleaseIds((prev) => {
      const next = prev.filter((id) => moderationQueueFiltered.some((row) => row.release.id === id));
      if (next.length === prev.length && next.every((id, idx) => id === prev[idx])) {
        return prev;
      }
      return next;
    });
  }, [moderationQueueFiltered]);

  const handlePublishSmartLink = useCallback(
    async (releaseId: string, newStatus: string, smartLink: string) => {
      setBusyId(releaseId);
      setActionError(null);
      try {
        await publishReleaseWithSmartLink(releaseId, newStatus, smartLink);
        triggerHaptic("success");
        setRejectModalReleaseId(null);
        setApproveModalReleaseId(null);
        await refreshAll();
        toast.success("Релиз выпущен, smart link сохранён");
        router.replace("/admin");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Не удалось выпустить релиз.";
        setActionError(msg);
        toast.error(msg);
      } finally {
        setBusyId(null);
      }
    },
    [refreshAll, router]
  );

  const handleRejectWithReason = useCallback(
    async (id: string, reason: string) => {
      setBusyId(id);
      setActionError(null);
      try {
        await rejectRelease(id, reason);
        hapticMap.notificationWarning();
        setRejectModalReleaseId(null);
        await refreshAll();
        toast.success("Релиз отклонён");
        router.replace("/admin");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Не удалось обновить статус релиза.";
        setActionError(msg);
        toast.error(msg);
      } finally {
        setBusyId(null);
      }
    },
    [refreshAll, router]
  );

  const toggleSelectRelease = useCallback((releaseId: string) => {
    setSelectedReleaseIds((prev) =>
      prev.includes(releaseId) ? prev.filter((id) => id !== releaseId) : [...prev, releaseId]
    );
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelectedReleaseIds(moderationQueueFiltered.map((row) => row.release.id));
  }, [moderationQueueFiltered]);

  const clearSelection = useCallback(() => {
    setSelectedReleaseIds([]);
  }, []);

  const handleBulkReject = useCallback(
    async (reason: string) => {
      if (selectedReleaseIds.length === 0) return;
      setBulkBusy(true);
      setActionError(null);
      let successCount = 0;
      let failedCount = 0;
      for (const releaseId of selectedReleaseIds) {
        try {
          await rejectRelease(releaseId, reason);
          successCount += 1;
        } catch {
          failedCount += 1;
        }
      }
      await refreshAll();
      setBulkBusy(false);
      setBulkRejectOpen(false);
      setSelectedReleaseIds([]);
      if (failedCount === 0) {
        hapticMap.notificationWarning();
        toast.success(`Отклонено релизов: ${successCount}`);
      } else {
        toast.error(`Отклонено: ${successCount}, с ошибкой: ${failedCount}`);
      }
    },
    [refreshAll, selectedReleaseIds]
  );

  const handleBulkApprove = useCallback(async () => {
    if (selectedReleaseIds.length === 0) return;
    setBulkBusy(true);
    setActionError(null);
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    for (const releaseId of selectedReleaseIds) {
      const row = moderationQueue.find((item) => item.release.id === releaseId);
      const smartLink = (row?.release.smart_link ?? "").trim();
      if (!smartLink) {
        skippedCount += 1;
        continue;
      }
      try {
        await publishReleaseWithSmartLink(releaseId, "RELEASED", smartLink);
        successCount += 1;
      } catch {
        failedCount += 1;
      }
    }
    await refreshAll();
    setBulkBusy(false);
    setSelectedReleaseIds([]);
    if (failedCount === 0 && skippedCount === 0) {
      triggerHaptic("success");
      toast.success(`Одобрено релизов: ${successCount}`);
      return;
    }
    if (failedCount === 0) {
      toast.success(`Одобрено: ${successCount}. Пропущено без smart-link: ${skippedCount}`);
      return;
    }
    toast.error(`Одобрено: ${successCount}, пропущено: ${skippedCount}, с ошибкой: ${failedCount}`);
  }, [moderationQueue, refreshAll, selectedReleaseIds]);

  if (adminResolved && !isAdmin) {
    return null;
  }

  if (userId == null && !isAdmin && process.env.NODE_ENV === "production") {
    return (
      <div className="glass-glow glass-glow-charged mx-5 mt-14 p-6">
        <h1 className="font-display text-xl font-bold text-white/85">Панель модерации</h1>
        <p className="mt-2 text-sm text-white/50">Открой приложение из Telegram для доступа к админке.</p>
      </div>
    );
  }

  const showQueueSkeleton = isLoading && data === undefined;
  return (
    <div className="min-h-app px-5 pb-44 pt-14">
      <PullRefreshBrand />

      <div className="mb-4 flex justify-end">
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={() => void refreshAll()}
          disabled={isValidating}
          aria-label="Обновить"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/70 backdrop-blur-md disabled:opacity-50"
        >
          <RefreshCcw className={`h-[18px] w-[18px] ${isValidating ? "animate-spin" : ""}`} />
        </motion.button>
      </div>

      <motion.h1 className="mb-5 font-display text-xl font-semibold tracking-tight text-white/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        Модерация
      </motion.h1>

      {statsErrorMessage && (
        <div className="glass-glow glass-glow-charged mb-4 p-4 text-sm text-amber-100/90">
          Счётчики: {statsErrorMessage}
        </div>
      )}

      <div className="mb-8">
        <Link
          href="/admin/history"
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs text-white/75 hover:bg-white/[0.08]"
        >
          <History className="h-4 w-4 shrink-0 opacity-90" />
          История решений
        </Link>
      </div>

      <AdminApproveSmartLinkModal
        releaseId={approveModalReleaseId}
        busy={approveModalReleaseId != null && busyId === approveModalReleaseId}
        onClose={() => setApproveModalReleaseId(null)}
        onSubmit={(id, newStatus, smartLink) => void handlePublishSmartLink(id, newStatus, smartLink)}
      />

      <AdminRejectModal
        releaseId={rejectModalReleaseId}
        busy={busyId === rejectModalReleaseId}
        onClose={() => setRejectModalReleaseId(null)}
        onSelectReason={(id, reason) => void handleRejectWithReason(id, reason)}
      />

      {bulkRejectOpen && (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end">
          <button
            type="button"
            aria-label="Закрыть массовое отклонение"
            className="absolute inset-0 bg-black/40 backdrop-blur-[20px]"
            onClick={() => !bulkBusy && setBulkRejectOpen(false)}
          />
          <div className="relative z-10 mx-auto w-full max-w-md rounded-t-[28px] border border-white/[0.12] border-b-0 bg-zinc-950/90 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-[0_-12px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" aria-hidden />
            <h3 className="text-lg font-semibold text-white">Массовое отклонение</h3>
            <p className="mt-1 text-[13px] text-white/55">
              Выбрано релизов: {selectedReleaseIds.length}. Выберите причину:
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2">
              {ADMIN_REJECT_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void handleBulkReject(preset.message)}
                  className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-rose-500/15 to-rose-950/40 px-4 py-3 text-left text-[14px] font-medium text-rose-50 transition-colors hover:border-rose-400/30 hover:from-rose-500/25 disabled:opacity-50"
                >
                  <span className="text-[11px] uppercase tracking-[0.14em] text-rose-200/80">
                    {preset.label}
                  </span>
                  <span className="mt-1 block text-[12px] font-normal leading-snug text-white/75">
                    {preset.message}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <h2 className="mb-3 text-xs font-semibold tracking-wide text-white/50">Очередь</h2>

      <div className="mb-6 flex flex-wrap gap-2">
        {([
          { key: "all", label: "Все" },
          { key: "needs_smart_link", label: "Без smart-link" },
          { key: "with_errors", label: "С ошибками" }
        ] as const).map((filter) => {
          const isActive = activeFilter === filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "border-violet-400/50 bg-violet-500/20 text-violet-100"
                  : "border-white/[0.1] bg-white/[0.04] text-white/65 hover:bg-white/[0.08]"
              }`}
            >
              {filter.label}
              <span
                className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] ${
                  isActive ? "bg-violet-200/20 text-violet-100" : "bg-white/10 text-white/70"
                }`}
              >
                {filterCounts[filter.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-5">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск: ID, артист, название, smart-link"
          className="w-full rounded-2xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-sm text-white/85 placeholder:text-white/35 focus:border-violet-400/45 focus:outline-none focus:ring-1 focus:ring-violet-400/30"
        />
      </div>

      {moderationQueueFiltered.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void selectAllFiltered()}
            className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/[0.08]"
          >
            Выбрать все ({moderationQueueFiltered.length})
          </button>
          <button
            type="button"
            onClick={() => void clearSelection()}
            disabled={selectedReleaseIds.length === 0}
            className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/[0.08] disabled:opacity-50"
          >
            Сбросить
          </button>
          <button
            type="button"
            onClick={() => void handleBulkApprove()}
            disabled={selectedReleaseIds.length === 0 || selectedWithSmartLinkCount === 0 || bulkBusy}
            className="rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
          >
            Одобрить выбранные ({selectedWithSmartLinkCount})
          </button>
          <button
            type="button"
            onClick={() => setBulkRejectOpen(true)}
            disabled={selectedReleaseIds.length === 0 || bulkBusy}
            className="rounded-xl border border-rose-300/35 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/25 disabled:opacity-50"
          >
            Отклонить выбранные ({selectedReleaseIds.length})
          </button>
          {selectedReleaseIds.length > 0 && selectedWithoutSmartLinkCount > 0 ? (
            <span className="text-xs text-amber-200/85">Без smart-link: {selectedWithoutSmartLinkCount}</span>
          ) : null}
        </div>
      )}

      {showQueueSkeleton && <AdminModerationQueueSkeleton rows={3} />}
      {errorMessage && (
        <div className="glass-glow glass-glow-charged mb-4 p-4 text-sm text-rose-200">{errorMessage}</div>
      )}
      {actionError && (
        <div className="glass-glow glass-glow-charged mb-4 p-4 text-sm text-rose-200">{actionError}</div>
      )}

      {!showQueueSkeleton && !errorMessage && moderationQueueFiltered.length === 0 && (
        <div className="glass-glow glass-glow-charged p-5 text-sm text-white/50">
          {moderationQueue.length === 0
            ? "На данный момент новых релизов на проверку нет."
            : "По фильтру или поисковому запросу релизов не найдено."}
        </div>
      )}

      {moderationQueueFiltered.length > 0 && (
        <motion.div
          className="flex flex-col gap-3"
          variants={adminQueueContainer}
          initial="hidden"
          animate="show"
        >
          {moderationQueueFiltered.map((row, index) => (
            <motion.div
              key={row.release.id}
              variants={adminQueueItem}
              initial="hidden"
              animate="show"
              className="relative"
            >
              <label className="absolute right-3 top-3 z-20 inline-flex items-center rounded-lg border border-white/15 bg-black/45 px-2 py-1 text-[11px] text-white/80 backdrop-blur-sm">
                <input
                  type="checkbox"
                  checked={selectedReleaseIds.includes(row.release.id)}
                  onChange={() => toggleSelectRelease(row.release.id)}
                  className="h-3.5 w-3.5 accent-violet-500"
                />
              </label>
              <AdminReleaseCard
                release={row.release}
                tracks={row.tracks}
                index={index}
                listVariants={undefined}
                busy={busyId === row.release.id}
                onOpenApprove={() => setApproveModalReleaseId(row.release.id)}
                onOpenReject={() => setRejectModalReleaseId(row.release.id)}
                showAudioPreview={false}
                detailHref={`/admin/release/${row.release.id}`}
                artworkPriority={index < 3}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
