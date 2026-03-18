"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";
import { getTelegramUserId, initTelegramWebApp } from "@/lib/telegram";

type ReleaseRow = {
  id: string;
  track_name: string;
  artwork_url: string | null;
  status: string;
  created_at: string;
};

const statusLabel: Record<string, string> = {
  draft: "Черновик",
  processing: "На модерации",
  under_review: "На проверке",
  ready: "Готов",
  failed: "Ошибка"
};

export default function LibraryPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [releases, setReleases] = useState<ReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initTelegramWebApp();
    setUserId(getTelegramUserId());
  }, []);

  useEffect(() => {
    if (userId == null) {
      setLoading(false);
      setReleases([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: dbError } = await supabase
          .from("releases")
          .select("id, track_name, artwork_url, status, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (dbError) throw dbError;
        if (!cancelled) setReleases((data ?? []) as ReleaseRow[]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Не удалось загрузить библиотеку.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="flex flex-col gap-4 pb-10">
      <GlassCard className="p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-white/55">Библиотека</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Каталог релизов</h1>
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
                {statusLabel[release.status] ?? release.status}
              </span>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
