"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, RefreshCcw } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";
import { AdminApproveSmartLinkModal } from "@/components/AdminApproveSmartLinkModal";
import { AdminRejectModal } from "@/components/AdminRejectModal";
import { AdminReleaseCard } from "@/components/AdminReleaseCard";
import { AdminStatsPanel } from "@/components/admin/AdminStatsPanel";
import { AdminStuckList } from "@/components/admin/AdminStuckList";
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
    async (id: string, reason: string, reasonKeys: string[]) => {
      setBusyId(id);
      setActionError(null);
      try {
        await rejectRelease(id, reason, reasonKeys);
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
    async (reason: string, reasonKeys: string[]) => {
      if (selectedReleaseIds.length === 0) return;
      setBulkBusy(true);
      setActionError(null);
      let successCount = 0;
      let failedCount = 0;
      for (const releaseId of selectedReleaseIds) {
        try {
          await rejectRelease(releaseId, reason, reasonKeys);
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
      <div className="mx-auto max-w-lg px-1 pt-10">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">Модерация</h1>
        <p className="mt-2 text-[15px] text-omf-graphite">
          Открой приложение из Telegram, чтобы попасть в админку.
        </p>
      </div>
    );
  }

  const showQueueSkeleton = isLoading && data === undefined;
  return (
    <div className="mx-auto min-h-app max-w-lg px-1 pb-40 pt-6 text-omf-ink">
      <PullRefreshBrand />

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] text-omf-graphite">
            В очереди: {moderationQueue.length}
            {stats?.oldest_wait_hours != null && moderationQueue.length > 0 ? (
              <span className={stats.oldest_wait_hours >= 24 ? "text-omf-red" : undefined}>
                {" "}
                · ждёт до {stats.oldest_wait_hours} ч
              </span>
            ) : null}
          </p>
          <h1 className="mt-1 text-[40px] font-extrabold leading-[0.92] tracking-[-0.045em]">Модерация</h1>
        </div>
        <div className="mt-1 flex shrink-0 items-center gap-1">
          <Link
            href="/admin/history"
            aria-label="История решений"
            title="История решений"
            className="omf-focus flex h-10 w-10 items-center justify-center rounded-full text-omf-graphite transition-colors hover:bg-omf-surface hover:text-omf-ink"
          >
            <History className="h-[18px] w-[18px]" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={isValidating}
            aria-label="Обновить очередь"
            className="omf-focus flex h-10 w-10 items-center justify-center rounded-full text-omf-graphite transition-colors hover:bg-omf-surface hover:text-omf-ink disabled:opacity-50"
          >
            <RefreshCcw className={`h-[18px] w-[18px] ${isValidating ? "animate-spin" : ""}`} aria-hidden />
          </button>
        </div>
      </header>

      <AdminApproveSmartLinkModal
        releaseId={approveModalReleaseId}
        busy={approveModalReleaseId != null && busyId === approveModalReleaseId}
        onClose={() => setApproveModalReleaseId(null)}
        onSubmit={(id, newStatus, smartLink) => void handlePublishSmartLink(id, newStatus, smartLink)}
      />

      <AdminRejectModal
        open={rejectModalReleaseId != null}
        busy={rejectModalReleaseId != null && busyId === rejectModalReleaseId}
        onClose={() => setRejectModalReleaseId(null)}
        onSubmit={(reason, keys) => {
          if (rejectModalReleaseId) void handleRejectWithReason(rejectModalReleaseId, reason, keys);
        }}
      />

      <AdminRejectModal
        open={bulkRejectOpen}
        busy={bulkBusy}
        count={selectedReleaseIds.length}
        onClose={() => setBulkRejectOpen(false)}
        onSubmit={(reason, keys) => void handleBulkReject(reason, keys)}
      />

      <div
        className="mb-4 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Фильтр очереди"
      >
        {([
          { key: "all", label: "Все" },
          { key: "needs_smart_link", label: "Без ссылки" },
          { key: "with_errors", label: "С ошибками" }
        ] as const).map((filter) => {
          const isActive = activeFilter === filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveFilter(filter.key)}
              className={`omf-focus shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
                isActive ? "bg-omf-ink font-medium text-omf-bg" : "text-omf-graphite hover:text-omf-ink"
              }`}
            >
              {filter.label}
              <span className={`ml-1.5 tabular-nums ${isActive ? "text-omf-bg/70" : "text-omf-faint"}`}>
                {filterCounts[filter.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-4">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Артист, название или ID"
          aria-label="Поиск по очереди"
          className="omf-focus min-h-[48px] w-full rounded-control border border-omf-line bg-omf-surface px-4 py-3 text-[16px] text-omf-ink placeholder:text-omf-faint focus:border-omf-ultra focus:outline-none"
        />
      </div>

      {moderationQueueFiltered.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-[13px]">
          <button
            type="button"
            onClick={() => void selectAllFiltered()}
            className="omf-focus rounded-full px-2.5 py-1.5 text-omf-ultra-text hover:text-omf-ink"
          >
            Выбрать все ({moderationQueueFiltered.length})
          </button>
          {selectedReleaseIds.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => void clearSelection()}
                className="omf-focus rounded-full px-2.5 py-1.5 text-omf-graphite hover:text-omf-ink"
              >
                Сбросить
              </button>
              <button
                type="button"
                onClick={() => void handleBulkApprove()}
                disabled={selectedWithSmartLinkCount === 0 || bulkBusy}
                className="omf-focus rounded-full px-2.5 py-1.5 font-medium text-omf-green hover:text-omf-ink disabled:opacity-40"
              >
                Одобрить выбранные ({selectedWithSmartLinkCount})
              </button>
              <button
                type="button"
                onClick={() => setBulkRejectOpen(true)}
                disabled={bulkBusy}
                className="omf-focus rounded-full px-2.5 py-1.5 font-medium text-omf-red hover:text-omf-ink disabled:opacity-40"
              >
                Вернуть выбранные ({selectedReleaseIds.length})
              </button>
              {selectedWithoutSmartLinkCount > 0 ? (
                <span className="px-2.5 text-omf-yellow">без ссылки: {selectedWithoutSmartLinkCount}</span>
              ) : null}
            </>
          ) : null}
        </div>
      )}

      {showQueueSkeleton && <AdminModerationQueueSkeleton rows={3} />}
      {errorMessage && (
        <p className="mb-4 text-[14px] text-omf-red">{errorMessage}</p>
      )}
      {actionError && (
        <p className="mb-4 text-[14px] text-omf-red">{actionError}</p>
      )}

      {!showQueueSkeleton && !errorMessage && moderationQueueFiltered.length === 0 && (
        <div className="border-t border-omf-line pt-6">
          <p className="text-[18px] font-bold tracking-tight">
            {moderationQueue.length === 0 ? "Очередь пуста" : "Ничего не найдено"}
          </p>
          <p className="mt-1.5 text-[14px] text-omf-graphite">
            {moderationQueue.length === 0
              ? "Новые релизы появятся здесь, когда артисты отправят их на проверку."
              : "Попробуй другой фильтр или поменяй запрос."}
          </p>
        </div>
      )}

      {moderationQueueFiltered.length > 0 && (
        <div className="flex flex-col">
          {moderationQueueFiltered.map((row, index) => {
            const checked = selectedReleaseIds.includes(row.release.id);
            return (
              <div key={row.release.id} className="relative">
                <label className="absolute right-0 top-5 z-20 inline-flex h-11 w-11 cursor-pointer items-center justify-center">
                  <span className="sr-only">Выбрать «{row.release.artist_name}»</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelectRelease(row.release.id)}
                    className="h-5 w-5 rounded-[6px] accent-[var(--omf-ultra)]"
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
              </div>
            );
          })}
        </div>
      )}

      {stats ? <AdminStuckList stuck={stats.stuck} /> : null}
      {stats && !statsErrorMessage ? <AdminStatsPanel stats={stats} /> : null}
      {statsErrorMessage ? (
        <p className="mt-6 text-[14px] text-omf-yellow">Не удалось загрузить счётчики: {statsErrorMessage}</p>
      ) : null}
    </div>
  );
}
