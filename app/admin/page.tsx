"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { getExpectedAdminTelegramId } from "@/lib/admin";
import { supabase } from "@/lib/supabase";
import { getTelegramUserId, initTelegramWebApp } from "@/lib/telegram";

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
  const [moderationQueue, setModerationQueue] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const expectedAdminId = useMemo(() => getExpectedAdminTelegramId(), []);
  const isAdmin = userId === expectedAdminId;

  useEffect(() => {
    initTelegramWebApp();
    setUserId(getTelegramUserId());
  }, []);

  const loadQueue = useCallback(async () => {
    if (!isAdmin) {
      setModerationQueue([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("releases")
        .select("id, artist_name, track_name, genre, artwork_url, status, created_at")
        .eq("status", "processing")
        .order("created_at", { ascending: false });
      if (dbError) throw dbError;
      setModerationQueue((data ?? []) as ModerationItem[]);
    } catch (e: any) {
      setError(e?.message ?? "Не удалось загрузить очередь модерации.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const updateStatus = useCallback(
    async (id: string, status: "ready" | "failed") => {
      setBusyId(id);
      setError(null);
      try {
        const patch =
          status === "failed"
            ? { status, error_message: "Отклонено модератором" }
            : { status, error_message: null };
        const { error: dbError } = await supabase.from("releases").update(patch).eq("id", id);
        if (dbError) throw dbError;
        await loadQueue();
      } catch (e: any) {
        setError(e?.message ?? "Не удалось обновить статус релиза.");
      } finally {
        setBusyId(null);
      }
    },
    [loadQueue]
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
        <p className="text-xs uppercase tracking-[0.2em] text-white/55">Админ</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Очередь модерации</h1>
      </GlassCard>

      {loading && <GlassCard className="p-4 text-sm text-white/70">Загружаем очередь...</GlassCard>}
      {error && <GlassCard className="p-4 text-sm text-rose-200">{error}</GlassCard>}

      {!loading && !error && moderationQueue.length === 0 && (
        <GlassCard className="p-4 text-sm text-white/70">
          На данный момент новых релизов на проверку нет.
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
                  onClick={() => void updateStatus(release.id, "failed")}
                  whileHover={{ scale: 0.99 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/40 bg-rose-500/20 px-3 py-2 text-sm text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.35)] disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  Отклонить
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

