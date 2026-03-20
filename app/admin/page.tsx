"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Info, RefreshCcw } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";
import { AdminReleaseCard } from "@/components/AdminReleaseCard";
import { GlassCard } from "@/components/GlassCard";
import { approveRelease, rejectRelease } from "@/features/admin/actions";
import { isAdminUi } from "@/lib/admin";
import { debugInit } from "@/lib/debug";
import {
  getPendingReleases,
  getReleaseTracksByReleaseId,
  type ReleaseRecord,
  type ReleaseTrackRow
} from "@/repositories/releases.repo";
import { sendApprovalNotification } from "@/lib/bot-api";
import { getTelegramUserId, initTelegramWebApp, triggerHaptic } from "@/lib/telegram";
import { withRequestTimeout } from "@/lib/withRequestTimeout";

type ModerationQueueRow = {
  release: ReleaseRecord;
  tracks: ReleaseTrackRow[];
};

const ADMIN_QUEUE_TIMEOUT_MS = 12000;

export default function AdminPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedRejectId, setExpandedRejectId] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const isAdmin = isAdminUi();

  useEffect(() => {
    debugInit("admin", "init start");
    initTelegramWebApp();
    setUserId(getTelegramUserId());
    debugInit("admin", "init done");
  }, []);

  const swrKey = isAdmin ? (["admin-moderation-queue"] as const) : null;

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
        `Запрос превысил таймаут (${ADMIN_QUEUE_TIMEOUT_MS} мс).`
      ),
    {
      refreshInterval: 8000,
      keepPreviousData: true
    }
  );

  const moderationQueue = data ?? [];
  const errorMessage =
    error instanceof Error ? error.message : error != null ? String(error) : null;

  const handleApprove = useCallback(
    async (release: ReleaseRecord) => {
      setBusyId(release.id);
      setActionError(null);
      try {
        triggerHaptic("success");
        const updated = await approveRelease(release.id);
        setExpandedRejectId(null);
        try {
          await sendApprovalNotification(updated);
        } catch (e: unknown) {
          console.error("sendApprovalNotification failed:", e);
        }
        await mutate();
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
    [mutate, router]
  );

  const confirmReject = useCallback(
    async (id: string) => {
      if (
        !window.confirm(
          "Отклонить релиз? Артист увидит указанную причину в уведомлении."
        )
      ) {
        return;
      }
      setBusyId(id);
      setActionError(null);
      try {
        triggerHaptic("warning");
        await rejectRelease(id, rejectReasons[id] ?? "");
        setExpandedRejectId(null);
        await mutate();
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
    [rejectReasons, mutate, router]
  );

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

  if (!isAdmin) {
    return (
      <GlassCard className="p-5">
        <h1 className="text-xl font-semibold tracking-tight">Панель модерации</h1>
        <p className="mt-2 text-sm text-white/65">Доступ только для администратора.</p>
      </GlassCard>
    );
  }

  const showQueueSkeleton = isLoading && data === undefined;

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
            onClick={() => void mutate(undefined, { revalidate: true })}
            disabled={isValidating}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 disabled:opacity-60"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${isValidating ? "animate-spin" : ""}`} />
            {isValidating ? "Обновляем..." : "Обновить"}
          </motion.button>
        </div>
      </GlassCard>

      {showQueueSkeleton && (
        <GlassCard className="p-4 text-sm text-white/70">Загружаем очередь...</GlassCard>
      )}
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
              onApprove={() => void handleApprove(row.release)}
              onToggleReject={() =>
                setExpandedRejectId((prev) => (prev === row.release.id ? null : row.release.id))
              }
              onRejectReasonChange={(value) =>
                setRejectReasons((prev) => ({ ...prev, [row.release.id]: value }))
              }
              onCancelReject={() => setExpandedRejectId(null)}
              onConfirmReject={() => void confirmReject(row.release.id)}
              detailHref={`/admin/release/${row.release.id}`}
              artworkPriority={index < 3}
            />
          ))}
        </div>
      )}
    </div>
  );
}
