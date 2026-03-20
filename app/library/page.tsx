"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/GlassCard";
import { debugInit } from "@/lib/debug";
import { getReleaseStatusMeta, normalizeReleaseStatus } from "@/lib/release-status";
import { supabase } from "@/lib/supabase";
import { getTelegramUserId, initTelegramWebApp } from "@/lib/telegram";
import { useSafePolling } from "@/lib/useSafePolling";

type ReleaseRow = {
  id: string;
  track_name: string;
  artwork_url: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

export default function LibraryPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    debugInit("library", "init start");
    initTelegramWebApp();
    setUserId(getTelegramUserId());
    debugInit("library", "init done");
  }, []);

  const loadReleases = useCallback(async () => {
    if (userId == null) return [] as ReleaseRow[];
    const { data, error: dbError } = await supabase
      .from("releases")
      .select("id, track_name, artwork_url, status, error_message, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (dbError) throw dbError;
    return (data ?? []) as ReleaseRow[];
  }, [userId]);

  const {
    data: releases,
    loading,
    refreshing,
    error,
    reload: loadWithSafety
  } = useSafePolling<ReleaseRow[]>({
    enabled: userId != null,
    intervalMs: 8000,
    load: loadReleases,
    initialData: [],
    requestTimeoutMs: 12000,
    debugName: "library.releases"
  });

  return (
    <div className="flex flex-col gap-4 pb-10">
      <GlassCard className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Мои релизы</h1>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 0.99 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            onClick={() => void loadWithSafety(true)}
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
          {releases.map((release, index) => {
            const statusMeta = getReleaseStatusMeta(release.status);
            return (
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
                  {normalizeReleaseStatus(release.status) === "failed" && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-rose-200/85">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {release.error_message?.trim()
                        ? `Причина: ${release.error_message}`
                        : "Нажмите, чтобы посмотреть причину отклонения"}
                    </p>
                  )}
                </div>
                <span className={`rounded-full border px-2 py-1 text-[10px] ${statusMeta.badgeClassName}`}>
                  {statusMeta.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
