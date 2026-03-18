"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Info, RefreshCcw, XCircle } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { getExpectedAdminTelegramId } from "@/lib/admin";
import { getReleaseStatusMeta, normalizeReleaseStatus } from "@/lib/release-status";
import { supabase } from "@/lib/supabase";
import { getTelegramUserId, initTelegramWebApp } from "@/lib/telegram";
import { useSafePolling } from "@/lib/useSafePolling";

type ModerationItem = {
  id: string;
  artist_name: string;
  track_name: string;
  genre: string;
  artwork_url: string | null;
  status: string;
  created_at: string;
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
    initTelegramWebApp();
    setUserId(getTelegramUserId());
  }, []);

  const loadQueue = useCallback(async () => {
    if (!isAdmin) {
      return [] as ModerationItem[];
    }
    const { data, error: dbError } = await supabase
      .from("releases")
      .select("id, artist_name, track_name, genre, artwork_url, status, created_at")
      .order("created_at", { ascending: false })
      .limit(150);
    if (dbError) throw dbError;
    const queue = ((data ?? []) as ModerationItem[]).filter(
      (item) => normalizeReleaseStatus(item.status) === "processing"
    );
    return queue;
  }, [isAdmin]);

  const {
    data: moderationQueue,
    loading,
    refreshing,
    error,
    reload: reloadQueue
  } = useSafePolling<ModerationItem[]>({
    enabled: isAdmin,
    intervalMs: 8000,
    load: loadQueue,
    initialData: []
  });

  const updateStatus = useCallback(
    async (id: string, status: "ready" | "failed") => {
      setBusyId(id);
      setActionError(null);
      try {
        const rejectReason = (rejectReasons[id] ?? "").trim();
        const patch =
          status === "failed"
            ? { status, error_message: rejectReason || "Отклонено модератором" }
            : { status, error_message: null };
        const { error: dbError } = await supabase.from("releases").update(patch).eq("id", id);
        if (dbError) throw dbError;
        setExpandedRejectId(null);
        await reloadQueue();
      } catch (e: any) {
        setActionError(e?.message ?? "Не удалось обновить статус релиза.");
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
    <div className="flex flex-col gap-4 pb-10">
      <GlassCard className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/55">Админ</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Очередь модерации</h1>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 0.99 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            onClick={() => void reloadQueue(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 disabled:opacity-60"
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
            <Info className="h-4 w-4" />
            <p className="text-sm">На данный момент новых релизов на проверку нет.</p>
          </div>
        </GlassCard>
      )}

      {!loading && moderationQueue.length > 0 && (
        <div className="space-y-3">
          {moderationQueue.map((release, index) => (
            <motion.div
              key={release.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 0.995 }}
              whileTap={{ scale: 0.98 }}
              transition={{ delay: index * 0.06, type: "spring", stiffness: 280, damping: 24 }}
              className="glass-card p-4"
            >
              <div className="flex gap-3">
                <div className="h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                  {release.artwork_url ? (
                    <img
                      src={release.artwork_url}
                      alt={release.track_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-white/50">
                      NO ART
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium">{release.track_name}</p>
                  <p className="text-sm text-white/60">{release.artist_name}</p>
                  <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] ${getReleaseStatusMeta(release.status).badgeClassName}`}>
                    {getReleaseStatusMeta(release.status).label}
                  </span>
                  <p className="text-xs text-white/50">
                    {release.genre} ·{" "}
                    {new Date(release.created_at).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <motion.button
                  type="button"
                  disabled={busyId === release.id}
                  onClick={() => void updateStatus(release.id, "ready")}
                  whileHover={{ scale: 0.99 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-3 py-2 text-sm text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.35)] disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Одобрить
                </motion.button>
                <motion.button
                  type="button"
                  disabled={busyId === release.id}
                  onClick={() => {
                    setExpandedRejectId((prev) => (prev === release.id ? null : release.id));
                  }}
                  whileHover={{ scale: 0.99 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/40 bg-rose-500/20 px-3 py-2 text-sm text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.35)] disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  Отклонить
                </motion.button>
              </div>
              {expandedRejectId === release.id && (
                <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-white/65">Причина отклонения (увидит артист)</p>
                  <textarea
                    value={rejectReasons[release.id] ?? ""}
                    onChange={(event) =>
                      setRejectReasons((prev) => ({ ...prev, [release.id]: event.target.value }))
                    }
                    rows={3}
                    placeholder="Например: Проблема с правами, невалидная обложка, шум в WAV."
                    className="w-full resize-none rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/35"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedRejectId(null)}
                      className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      disabled={busyId === release.id}
                      onClick={() => void updateStatus(release.id, "failed")}
                      className="rounded-lg border border-rose-300/35 bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 disabled:opacity-60"
                    >
                      Подтвердить отклонение
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

