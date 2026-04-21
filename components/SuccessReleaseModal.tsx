"use client";

import { motion } from "framer-motion";
import type { CreateReleaseSuccessSummary } from "@/features/release/createRelease/types";

type Props = {
  summary: CreateReleaseSuccessSummary;
  onGoHome: () => void;
  onUploadAnother: () => void;
};

export function SuccessReleaseModal({ summary, onGoHome, onUploadAnother }: Props) {
  const title =
    (summary.releaseName ?? summary.trackName)?.trim() || "Релиз";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex w-full flex-col items-stretch py-6 md:items-center md:py-8"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-[6%] -z-10 h-52 w-52 -translate-x-1/2 rounded-[100px] bg-gradient-to-br from-violet-500/30 via-fuchsia-500/18 to-cyan-500/22 blur-[56px] opacity-90 md:top-[4%] md:h-56 md:w-[min(92vw,36rem)] md:rounded-[120px] md:blur-[88px]"
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[420px] space-y-5 rounded-[26px] border border-white/[0.1] bg-surface/92 px-6 py-8 text-left shadow-[0_24px_64px_rgba(0,0,0,0.82)] backdrop-blur-2xl md:max-w-3xl md:rounded-[28px] md:px-10 md:py-10"
      >
        <div className="flex items-start justify-between gap-3 md:gap-5">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400/90">
              Отправлено на модерацию
            </p>
            <h2 className="text-[clamp(1.15rem,4.2vw,1.45rem)] font-semibold leading-snug tracking-tight text-white md:text-[clamp(1.35rem,2.2vw,1.85rem)]">
              Релиз «{title}» отправлен!{" "}
              <span className="inline-block" aria-hidden>
                🚀
              </span>
            </h2>
          </div>
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/35 bg-emerald-500/15 text-xl shadow-[0_0_24px_rgba(52,211,153,0.25)] md:h-12 md:w-12 md:text-[1.35rem]"
            aria-hidden
          >
            ✓
          </div>
        </div>

        <div className="flex flex-col gap-5 pt-0 md:flex-row md:items-stretch md:gap-10">
          <div className="min-w-0 flex-1 space-y-5">
            <p className="text-[14px] leading-relaxed text-white/75 md:text-[15px] md:leading-[1.65]">
              Наш модератор уже слушает твой звук. Уведомление придёт в этот бот.
            </p>

            <div className="rounded-[18px] border border-white/[0.08] bg-black/35 px-4 py-3 backdrop-blur-md md:px-5 md:py-4">
              <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-white/40">Релиз</p>
              <p className="text-[15px] font-medium text-white/95 md:text-base">
                {summary.artistName} — {summary.releaseName ?? summary.trackName}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 pt-1 md:w-[min(100%,280px)] md:justify-center md:pt-0">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onGoHome}
              className="inline-flex h-[50px] w-full items-center justify-center rounded-[18px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[15px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.5)] md:min-h-[52px]"
            >
              На главную
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onUploadAnother}
              className="inline-flex h-[50px] w-full items-center justify-center rounded-[18px] border border-white/[0.14] bg-white/[0.05] text-[15px] font-semibold text-white/90 backdrop-blur-md transition-colors hover:bg-white/[0.08] md:min-h-[52px]"
            >
              Создать новый релиз
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
