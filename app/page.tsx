"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BadgeCheck, Plus } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { LoadingScreen } from "@/components/LoadingScreen";
import { artistProfile, dashboardStats, releases } from "@/lib/mock-data";

const statusStyles: Record<string, string> = {
  Live: "bg-emerald-400/20 text-emerald-200 border-emerald-300/40",
  Pending: "bg-amber-400/20 text-amber-200 border-amber-300/40",
  Rejected: "bg-rose-400/20 text-rose-200 border-rose-300/40"
};

const statusLabel: Record<string, string> = {
  Live: "В эфире",
  Pending: "На модерации",
  Rejected: "Отклонен"
};

export default function DashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 750);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 pb-10">
      <GlassCard className="p-5">
        <div className="flex items-center gap-4">
          <img
            src={artistProfile.avatarUrl}
            alt="Аватар артиста"
            className="h-14 w-14 rounded-2xl object-cover"
          />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/55">Профиль артиста</p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{artistProfile.name}</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/40 bg-sky-500/20 px-2 py-1 text-[10px] font-medium text-sky-100">
                <BadgeCheck className="h-3 w-3" />
                Проверен
              </span>
            </div>
            <p className="text-sm text-white/60">{artistProfile.handle}</p>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-3 gap-3">
        {dashboardStats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 0.995 }}
            whileTap={{ scale: 0.98 }}
            transition={{ delay: 0.08 * index, type: "spring", stiffness: 250, damping: 22 }}
            className="glass-card p-3"
          >
            <p className="text-[11px] tracking-tight text-white/55">{stat.label}</p>
            <p className="mt-2 text-lg font-semibold">{stat.value}</p>
            <p className="mt-1 text-[11px] text-white/55">{stat.delta}</p>
          </motion.div>
        ))}
      </div>

      <GlassCard className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-white/90">Библиотека релизов</h2>
          <p className="text-xs text-white/55">Свайп</p>
        </div>
        <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
          {releases.map((release) => (
            <motion.button
              key={release.id}
              type="button"
              whileHover={{ scale: 0.99 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              onClick={() => router.push(`/release/${release.id}`)}
              className="w-36 flex-shrink-0 text-left"
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/10">
                <img
                  src={release.coverUrl}
                  alt={release.title}
                  className="h-36 w-full object-cover"
                />
                <span
                  className={`absolute right-2 top-2 rounded-full border px-2 py-1 text-[10px] ${statusStyles[release.status]}`}
                >
                  {statusLabel[release.status]}
                </span>
              </div>
              <p className="mt-2 truncate text-sm font-medium">{release.title}</p>
              <p className="text-xs text-white/55">{release.streams} прослушиваний</p>
            </motion.button>
          ))}
        </div>
      </GlassCard>

      <motion.button
        type="button"
        whileHover={{ scale: 0.99 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        onClick={() => router.push("/release")}
        className="fixed bottom-24 right-6 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-[0_14px_35px_rgba(168,85,247,0.65)]"
      >
        <Plus className="h-6 w-6" />
      </motion.button>
    </div>
  );
}

