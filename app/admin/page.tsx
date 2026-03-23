"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { BarChart3, Info, RefreshCcw, TrendingUp } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";
import { AdminRejectModal } from "@/components/AdminRejectModal";
import { AdminReleaseCard } from "@/components/AdminReleaseCard";
import { GlassCard } from "@/components/GlassCard";
import { PullRefreshBrand } from "@/components/PullRefreshBrand";
import { approveRelease, rejectRelease } from "@/features/admin/actions";
import { isAdminUi } from "@/lib/admin";
import { debugInit } from "@/lib/debug";
import { fetchAdminStats } from "@/lib/fetch-admin-stats";
import {
  getPendingReleases,
  getReleaseTracksByReleaseId,
  type ReleaseRecord,
  type ReleaseTrackRow
} from "@/repositories/releases.repo";
import { hapticMap } from "@/lib/haptic-map";
import { getTelegramUserId, initTelegramWebApp, triggerHaptic } from "@/lib/telegram";
import { AdminModerationQueueSkeleton } from "@/components/ui/Skeleton";
import { errorToUserString, USER_REQUEST_TIMEOUT_MESSAGE } from "@/lib/errors";
import { SWR_LIST_OPTIONS } from "@/lib/swr-config";
import { withRequestTimeout } from "@/lib/withRequestTimeout";

type ModerationQueueRow = {
  release: ReleaseRecord;
  tracks: ReleaseTrackRow[];
};

const ADMIN_QUEUE_TIMEOUT_MS = 15000;

const adminQueueContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const adminQueueItem: Variants = {
  hidden: { opacity: 0, y: 8 },
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
  const isAdmin = isAdminUi();

  useEffect(() => {
    debugInit("admin", "init start");
    initTelegramWebApp();
    setUserId(getTelegramUserId());
    debugInit("admin", "init done");
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      router.replace("/");
    }
  }, [isAdmin, router]);

  const swrKey = isAdmin ? (["admin-moderation-queue"] as const) : null;
  const statsKey = isAdmin ? (["admin-stats"] as const) : null;

  const loadQueueCore = useCallback(async (): Promise<ModerationQueueRow[]> => {
    const releases = await getPendingReleases();
    const rows = await Promise.all(
      releases.map(async (release) => ({
        release,
        tracks: await getReleaseTracksByReleaseId(release.id)
      }))
    );
    return rows;
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

  const moderationQueue = data ?? [];
  const errorMessage = errorToUserString(error);
  const statsErrorMessage = errorToUserString(statsError);

  const refreshAll = useCallback(async () => {
    await Promise.all([mutate(undefined, { revalidate: true }), mutateStats(undefined, { revalidate: true })]);
  }, [mutate, mutateStats]);

  const handleApprove = useCallback(
    async (release: ReleaseRecord) => {
      setBusyId(release.id);
      setActionError(null);
      try {
        await approveRelease(release.id);
        triggerHaptic("success");
        setRejectModalReleaseId(null);
        await refreshAll();
        toast.success("Релиз одобрен");
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

  if (!isAdmin) {
    return null;
  }

  if (userId == null && process.env.NODE_ENV === "production") {
    return (
      <GlassCard className="p-5">
        <h1 className="text-xl font-semibold tracking-tight">Панель модерации</h1>
        <p className="mt-2 text-sm text-white/65">
          Открой приложение из Telegram для доступа к админке.
        </p>
      </GlassCard>
    );
  }

  const showQueueSkeleton = isLoading && data === undefined;
  const pendingQueueCount = stats?.pending_queue ?? moderationQueue.length;
  const readyToday = stats?.ready_today ?? 0;
  return (
    <div className="flex min-h-[100dvh] flex-col gap-4 pb-10">
      <PullRefreshBrand />
      <GlassCard className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/55">Админ</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Очередь модерации</h1>
            <p className="mt-1 text-[12px] text-white/45">
              Релизы со статусом «На проверке» (processing)
            </p>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 0.99 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            onClick={() => void refreshAll()}
            disabled={isValidating}
            className="inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 disabled:opacity-60"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${isValidating ? "animate-spin" : ""}`} />
            {isValidating ? "Обновляем..." : "Обновить"}
          </motion.button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-[18px] border border-white/[0.08] bg-black/25 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
              <BarChart3 className="h-3.5 w-3.5 text-sky-300/80" />
              В очереди
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{pendingQueueCount}</p>
          </div>
          <div className="rounded-[18px] border border-white/[0.08] bg-black/25 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-300/80" />
              Одобрено сегодня
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{readyToday}</p>
            <p className="mt-1 text-[10px] text-white/35">Статус «готов», с 00:00 UTC</p>
          </div>
          {/* Кошелёк заморожен — карточка «Сумма в холде» (pending_hold_sum) скрыта */}
        </div>
        {statsErrorMessage && (
          <p className="mt-3 text-[11px] text-amber-200/90">
            Счётчики: {statsErrorMessage} (очередь по списку ниже)
          </p>
        )}
      </GlassCard>

      <AdminRejectModal
        releaseId={rejectModalReleaseId}
        busy={busyId === rejectModalReleaseId}
        onClose={() => setRejectModalReleaseId(null)}
        onSelectReason={(id, reason) => void handleRejectWithReason(id, reason)}
      />

      {showQueueSkeleton && <AdminModerationQueueSkeleton rows={3} />}
      {errorMessage && <GlassCard className="p-4 text-sm text-rose-200">{errorMessage}</GlassCard>}
      {actionError && <GlassCard className="p-4 text-sm text-rose-200">{actionError}</GlassCard>}

      {!showQueueSkeleton && !errorMessage && moderationQueue.length === 0 && (
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-white/60">
            <Info className="h-4 w-4 shrink-0" />
            <p className="text-sm">На данный момент новых релизов на проверку нет.</p>
          </div>
        </GlassCard>
      )}

      {moderationQueue.length > 0 && (
        <motion.div
          className="grid grid-cols-1 gap-3"
          variants={adminQueueContainer}
          initial="hidden"
          animate="show"
        >
          {moderationQueue.map((row, index) => (
            <AdminReleaseCard
              key={row.release.id}
              release={row.release}
              tracks={row.tracks}
              index={index}
              listVariants={adminQueueItem}
              busy={busyId === row.release.id}
              onApprove={() => void handleApprove(row.release)}
              onOpenReject={() => setRejectModalReleaseId(row.release.id)}
              detailHref={`/admin/release/${row.release.id}`}
              artworkPriority={index < 3}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
