"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Info, RefreshCcw } from "lucide-react";
import { AdminReleaseCard } from "@/components/AdminReleaseCard";
import { GlassCard } from "@/components/GlassCard";
import { getExpectedAdminTelegramId } from "@/lib/admin";
import { debugInit } from "@/lib/debug";
import {
  getPendingReleases,
  getReleaseTracksByReleaseId,
  updateReleaseStatus,
  type ReleaseRecord,
  type ReleaseTrackRow
} from "@/repositories/releases.repo";
import { getTelegramUserId, initTelegramWebApp, triggerHaptic } from "@/lib/telegram";
import { useSafePolling } from "@/lib/useSafePolling";

type ModerationQueueRow = {
  release: ReleaseRecord;
  tracks: ReleaseTrackRow[];
};

export default function AdminPage() {
  const [userId, setUserId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedRejectId, setExpandedRejectId] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const expectedAdminId = useMemo(() => getExpectedAdminTelegramId(), []);
  const isAdmin = userId === expectedAdminId;

  useEffect(() => {
    debugInit("admin", "init start");
    initTelegramWebApp();
    setUserId(getTelegramUserId());
    debugInit("admin", "init done");
  }, []);

  const loadQueue = useCallback(async (): Promise<ModerationQueueRow[]> => {
    if (!isAdmin) {
      return [];
    }
    const releases = await getPendingReleases();
    const rows = await Promise.all(
      releases.map(async (release) => ({
        release,
        tracks: await getReleaseTracksByReleaseId(release.id)
      }))
    );
    return rows;
  }, [isAdmin]);

  const {
    data: moderationQueue,
    loading,
    refreshing,
    error,
    reload: reloadQueue
  } = useSafePolling<ModerationQueueRow[]>({
    enabled: isAdmin,
    intervalMs: 8000,
    load: loadQueue,
    initialData: [],
    requestTimeoutMs: 12000,
    debugName: "admin.queue"
  });

  const updateStatus = useCallback(
    async (id: string, status: "ready" | "failed") => {
      setBusyId(id);
      setActionError(null);
      try {
        triggerHaptic("medium");
        const rejectReason = (rejectReasons[id] ?? "").trim();
        await updateReleaseStatus(id, {
          status,
          error_message:
            status === "failed" ? rejectReason || "Отклонено модератором" : null
        });
        setExpandedRejectId(null);
        await reloadQueue();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Не удалось обновить статус релиза.";
        setActionError(msg);
      } finally {
        setBusyId(null);
      }
    },
    [rejectReasons, reloadQueue]
  );

  if (userId == null) {
    return (
      <GlassCard className="p-5">
        <h1 className="text-xl font-semibold tracking-tight">Панель модерации</h1>
        <p className="mt-2 text-sm text-white/65">
          Открой приложение из Telegram для доступа к админке.
        </p>
      </GlassCard>
    );
  }

  if (!isAdmin) {
    return (
      <GlassCard className="p-5">
        <h1 className="text-xl font-semibold tracking-tight">Панель модерации</h1>
        <p className="mt-2 text-sm text-white/65">Доступ только для администратора.</p>
      </GlassCard>
    );
  }

  return (
    <div className="flex max-h-[min(100dvh,900px)] flex-col gap-4 overflow-y-auto pb-10">
      <GlassCard className="p-5">
        <div className="flex items-center justify-between gap-3">
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
            onClick={() => void reloadQueue(true)}
            disabled={refreshing}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 disabled:opacity-60"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Обновляем..." : "Обновить"}
          </motion.button>
        </div>
      </GlassCard>

      {loading && <GlassCard className="p-4 text-sm text-white/70">Загружаем очередь...</GlassCard>}
      {error && <GlassCard className="p-4 text-sm text-rose-200">{error}</GlassCard>}
      {actionError && <GlassCard className="p-4 text-sm text-rose-200">{actionError}</GlassCard>}

      {!loading && !error && moderationQueue.length === 0 && (
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-white/60">
            <Info className="h-4 w-4 shrink-0" />
            <p className="text-sm">На данный момент новых релизов на проверку нет.</p>
          </div>
        </GlassCard>
      )}

      {!loading && moderationQueue.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {moderationQueue.map((row, index) => (
            <AdminReleaseCard
              key={row.release.id}
              release={row.release}
              tracks={row.tracks}
              index={index}
              busy={busyId === row.release.id}
              rejectExpanded={expandedRejectId === row.release.id}
              rejectReason={rejectReasons[row.release.id] ?? ""}
              onApprove={() => void updateStatus(row.release.id, "ready")}
              onToggleReject={() =>
                setExpandedRejectId((prev) => (prev === row.release.id ? null : row.release.id))
              }
              onRejectReasonChange={(value) =>
                setRejectReasons((prev) => ({ ...prev, [row.release.id]: value }))
              }
              onCancelReject={() => setExpandedRejectId(null)}
              onConfirmReject={() => void updateStatus(row.release.id, "failed")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
