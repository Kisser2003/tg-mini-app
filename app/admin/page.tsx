"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { isAdmin, pendingReleases, systemLogs } from "@/lib/mock-data";
import { readModerationQueue } from "@/lib/release-storage";

export default function AdminPage() {
  const [submittedQueue, setSubmittedQueue] = useState(() => readModerationQueue());

  useEffect(() => {
    const sync = () => setSubmittedQueue(readModerationQueue());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const moderationQueue = useMemo(
    () => [...submittedQueue, ...pendingReleases],
    [submittedQueue]
  );

  if (!isAdmin) {
    return (
      <GlassCard className="p-5">
        <h1 className="text-xl font-semibold tracking-tight">Панель модерации</h1>
        <p className="mt-2 text-sm text-white/65">Раздел доступен только при `isAdmin = true`.</p>
      </GlassCard>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-10">
      <GlassCard className="p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-white/55">Админ</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Очередь модерации</h1>
      </GlassCard>

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
              <img
                src={release.coverUrl}
                alt={release.title}
                className="h-16 w-16 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium">{release.title}</p>
                <p className="text-sm text-white/60">{release.artist}</p>
                <p className="text-xs text-white/50">
                  {release.genre} - {release.submittedAt}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <motion.button
                type="button"
                whileHover={{ scale: 0.99 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-3 py-2 text-sm text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.35)]"
              >
                <CheckCircle2 className="h-4 w-4" />
                Одобрить
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 0.99 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/40 bg-rose-500/20 px-3 py-2 text-sm text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.35)]"
              >
                <XCircle className="h-4 w-4" />
                Отклонить
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      <GlassCard className="p-4">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/55">Логи системы</p>
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] text-emerald-300/85">
          {systemLogs.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

