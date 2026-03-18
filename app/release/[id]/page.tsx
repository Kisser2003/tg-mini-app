"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Link2, ShieldCheck } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { releaseDetails } from "@/lib/mock-data";

const statusStyles: Record<string, string> = {
  Live: "bg-emerald-400/20 text-emerald-200 border-emerald-300/40",
  Pending: "bg-amber-400/20 text-amber-200 border-amber-300/40",
  Rejected: "bg-rose-400/20 text-rose-200 border-rose-300/40"
};

const statusLabel: Record<string, string> = {
  Live: "Опубликован",
  Pending: "На модерации",
  Rejected: "Отклонен"
};

export default function ReleaseDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const release = useMemo(() => releaseDetails[params.id], [params.id]);
  const maxValue = useMemo(
    () => (release ? Math.max(...release.streamTrend.map((point) => point.value), 1) : 1),
    [release]
  );
  const chart = useMemo(() => {
    if (!release) {
      return { areaPath: "", linePath: "" };
    }
    const width = 640;
    const height = 220;
    const baseline = 196;
    const stepX = width / Math.max(release.streamTrend.length - 1, 1);
    const points = release.streamTrend.map((point, index) => {
      const x = index * stepX;
      const y = baseline - (point.value / maxValue) * 150;
      return { x, y };
    });
    const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
    const areaPath = `${linePath} L${points[points.length - 1].x},${baseline} L${points[0].x},${baseline} Z`;
    return { areaPath, linePath };
  }, [maxValue, release]);

  const moderationChecklist = useMemo(
    () => [
      { title: "Проверка метаданных", done: release?.moderationStatus !== "Rejected" },
      { title: "Проверка обложки", done: release?.moderationStatus === "Live" || release?.moderationStatus === "Pending" },
      { title: "Доставка на платформы", done: release?.moderationStatus === "Live" }
    ],
    [release]
  );

  if (!release) {
    return (
      <GlassCard className="p-5">
        <h1 className="text-xl font-semibold tracking-tight">Релиз не найден</h1>
        <p className="mt-2 text-sm text-white/65">Это заглушка динамического маршрута.</p>
      </GlassCard>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-10">
      <GlassCard className="p-5">
        <motion.button
          type="button"
          whileHover={{ scale: 0.99 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Назад
        </motion.button>
        <div className="flex items-center gap-3">
          <img src={release.coverUrl} alt={release.title} className="h-16 w-16 rounded-2xl object-cover" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{release.title}</h1>
            <p className="text-sm text-white/60">{release.artist}</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium tracking-tight text-white/85">График стримов (7 дней)</p>
          <p className="text-sm font-semibold">{release.totalStreams}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <svg viewBox="0 0 640 220" className="h-40 w-full">
            <defs>
              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(56,189,248,0.7)" />
                <stop offset="100%" stopColor="rgba(56,189,248,0.02)" />
              </linearGradient>
            </defs>
            <motion.path
              d={chart.areaPath}
              fill="url(#areaGradient)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            />
            <motion.path
              d={chart.linePath}
              fill="none"
              stroke="rgba(125,211,252,0.95)"
              strokeWidth="4"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          </svg>
          <div className="mt-2 flex justify-between text-[10px] text-white/55">
            {release.streamTrend.map((point) => (
              <span key={point.label}>{point.label}</span>
            ))}
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <p className="mb-2 inline-flex items-center gap-2 text-sm text-white/75">
          <ShieldCheck className="h-4 w-4" />
          Статус модерации
        </p>
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusStyles[release.moderationStatus]}`}>
          {statusLabel[release.moderationStatus]}
        </span>
        <p className="mt-3 text-sm text-white/70">{release.moderationNote}</p>

        <div className="mt-4 space-y-2">
          {moderationChecklist.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 0.995 }}
              whileTap={{ scale: 0.98 }}
              transition={{ delay: index * 0.06, type: "spring", stiffness: 280, damping: 24 }}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
            >
              <motion.span
                initial={false}
                animate={{
                  backgroundColor: item.done ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.06)",
                  borderColor: item.done ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.15)"
                }}
                className="inline-flex h-5 w-5 items-center justify-center rounded-md border"
              >
                {item.done && <Check className="h-3.5 w-3.5 text-emerald-300" />}
              </motion.span>
              <span className="text-sm text-white/75">{item.title}</span>
            </motion.div>
          ))}
        </div>

        <motion.a
          href="https://example.com/omf-smart-link"
          target="_blank"
          rel="noreferrer"
          whileHover={{ scale: 0.99 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-sky-300/35 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100"
        >
          <Link2 className="h-3.5 w-3.5" />
          Smart Link
        </motion.a>
      </GlassCard>
    </div>
  );
}
