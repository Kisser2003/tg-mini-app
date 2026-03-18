"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { releases } from "@/lib/mock-data";

export default function LibraryPage() {
  return (
    <div className="flex flex-col gap-4 pb-10">
      <GlassCard className="p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-white/55">Библиотека</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Каталог релизов</h1>
      </GlassCard>

      <div className="space-y-3">
        {releases.map((release, index) => (
          <motion.div
            key={release.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 0.995 }}
            whileTap={{ scale: 0.98 }}
            transition={{ delay: index * 0.06, type: "spring", stiffness: 280, damping: 24 }}
            className="glass-card flex items-center gap-3 p-4"
          >
            <img src={release.coverUrl} alt={release.title} className="h-14 w-14 rounded-xl object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{release.title}</p>
              <p className="text-xs text-white/60">{release.streams} прослушиваний</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
