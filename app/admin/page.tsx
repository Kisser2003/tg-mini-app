"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { BarChart3, RefreshCcw, TrendingUp } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";
import { AdminRejectModal } from "@/components/AdminRejectModal";
import { AdminReleaseCard } from "@/components/AdminReleaseCard";
import { PullRefreshBrand } from "@/components/PullRefreshBrand";
import { StatsTile } from "@/components/StatsTile";
import { AdminModerationQueueSkeleton } from "@/components/ui/LibrarySkeleton";
import { approveRelease, rejectRelease } from "@/features/admin/actions";
import { fetchAdminModerationQueue } from "@/features/admin/moderation-queue";
import { isAdminUi } from "@/lib/admin";
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
      <div className="glass-glow glass-glow-charged mx-5 mt-14 p-6">
        <h1 className="font-display text-xl font-bold text-white/85">Панель модерации</h1>
        <p className="mt-2 text-sm text-white/50">Открой приложение из Telegram для доступа к админке.</p>
      </div>
    );
  }

  const showQueueSkeleton = isLoading && data === undefined;
  const pendingQueueCount = stats?.pending_queue ?? moderationQueue.length;
  const readyToday = stats?.ready_today ?? 0;

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

      <motion.h1
        className="mb-10 font-display text-2xl font-bold tracking-tight text-white/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        Админ
      </motion.h1>

      <div className="mb-12 flex flex-col gap-3 sm:flex-row">
        <StatsTile
          icon={BarChart3}
          label="В очереди"
          value={pendingQueueCount}
          delay={0.1}
          accentClass="gradient-text-blue"
        />
        <StatsTile
          icon={TrendingUp}
          label="Одобрено сегодня"
          value={readyToday}
          delay={0.2}
          accentClass="gradient-text-teal"
        />
      </div>

      {statsErrorMessage && (
        <div className="glass-glow glass-glow-charged mb-4 p-4 text-sm text-amber-100/90">
          Счётчики: {statsErrorMessage}
        </div>
      )}

      <AdminRejectModal
        releaseId={rejectModalReleaseId}
        busy={busyId === rejectModalReleaseId}
        onClose={() => setRejectModalReleaseId(null)}
        onSelectReason={(id, reason) => void handleRejectWithReason(id, reason)}
      />

      <h2 className="mb-6 font-display text-sm font-bold tracking-tight text-white/50">Очередь модерации</h2>

      {showQueueSkeleton && <AdminModerationQueueSkeleton rows={3} />}
      {errorMessage && (
        <div className="glass-glow glass-glow-charged mb-4 p-4 text-sm text-rose-200">{errorMessage}</div>
      )}
      {actionError && (
        <div className="glass-glow glass-glow-charged mb-4 p-4 text-sm text-rose-200">{actionError}</div>
      )}

      {!showQueueSkeleton && !errorMessage && moderationQueue.length === 0 && (
        <div className="glass-glow glass-glow-charged p-5 text-sm text-white/50">
          На данный момент новых релизов на проверку нет.
        </div>
      )}

      {moderationQueue.length > 0 && (
        <motion.div
          className="flex flex-col gap-3"
          variants={adminQueueContainer}
          initial="hidden"
          animate="show"
        >
          {moderationQueue.map((row, index) => (
            <motion.div
              key={row.release.id}
              variants={adminQueueItem}
              initial="hidden"
              animate="show"
            >
              <AdminReleaseCard
                release={row.release}
                tracks={row.tracks}
                index={index}
                listVariants={undefined}
                busy={busyId === row.release.id}
                onApprove={() => void handleApprove(row.release)}
                onOpenReject={() => setRejectModalReleaseId(row.release.id)}
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
