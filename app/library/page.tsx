"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/GlassCard";
import { getReleaseStatusLabel } from "@/lib/release-status";
import { supabase } from "@/lib/supabase";
import { getTelegramUserId, initTelegramWebApp } from "@/lib/telegram";

type ReleaseRow = {
  id: string;
  track_name: string;
  artwork_url: string | null;
  status: string;
  created_at: string;
};

export default function LibraryPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [releases, setReleases] = useState<ReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initTelegramWebApp();
    setUserId(getTelegramUserId());
  }, []);

  const loadReleases = useCallback(
    async (silent = false) => {
      if (userId == null) {
        setLoading(false);
        setReleases([]);
        return;
      }
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const { data, error: dbError } = await supabase
          .from("releases")
          .select("id, track_name, artwork_url, status, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (dbError) throw dbError;
        setReleases((data ?? []) as ReleaseRow[]);
      } catch (e: any) {
        setError(e?.message ?? "Не удалось загрузить библиотеку.");
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (userId == null) {
      setLoading(false);
      setReleases([]);
      return;
    }
    let cancelled = false;
    void loadReleases();
    const intervalId = window.setInterval(() => {
      if (!cancelled) void loadReleases(true);
    }, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [loadReleases, userId]);

  return (
    <div className="flex flex-col gap-4 pb-10">
      <GlassCard className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/55">Мои релизы</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Список релизов</h1>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 0.99 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            onClick={() => void loadReleases(true)}
            disabled={refreshing}
            className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 disabled:opacity-60"
          >
            {refreshing ? "Обновляем..." : "Обновить"}
          </motion.button>
        </div>
      </GlassCard>

      {loading && <GlassCard className="p-4 text-sm text-white/70">Загружаем релизы...</GlassCard>}

      {error && <GlassCard className="p-4 text-sm text-rose-200">{error}</GlassCard>}

      {!loading && !error && releases.length === 0 && (
        <GlassCard className="p-4 text-sm text-white/70">Пока нет релизов. Создай первый в разделе `Новый релиз`.</GlassCard>
      )}

      {!loading && !error && releases.length > 0 && (
        <div className="space-y-3">
          {releases.map((release, index) => (
            <motion.button
              key={release.id}
              type="button"
              onClick={() => router.push(`/release/${release.id}`)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 0.995 }}
              whileTap={{ scale: 0.98 }}
              transition={{ delay: index * 0.06, type: "spring", stiffness: 280, damping: 24 }}
              className="glass-card flex w-full items-center gap-3 p-4 text-left"
            >
              <div className="h-14 w-14 overflow-hidden rounded-xl border border-white/10 bg-white/5">
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
                <p className="truncate text-sm font-medium">{release.track_name}</p>
                <p className="text-xs text-white/60">
                  {new Date(release.created_at).toLocaleDateString("ru-RU")}
                </p>
              </div>
              <span className="rounded-full border border-white/20 px-2 py-1 text-[10px] text-white/75">
                {getReleaseStatusLabel(release.status)}
              </span>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
