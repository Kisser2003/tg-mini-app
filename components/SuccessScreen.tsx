import { motion } from "framer-motion";
import type { CreateReleaseSuccessSummary } from "@/features/release/createRelease/types";

type Props = {
  summary: CreateReleaseSuccessSummary;
  onGoHome: () => void;
  onUploadAnother: () => void;
};

export function SuccessScreen({ summary, onGoHome, onUploadAnother }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center py-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-[420px] rounded-[24px] bg-surface/90 px-6 py-6 shadow-[0_22px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl border border-white/[0.08] text-left space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-[0.26em] text-white/40 uppercase">
              OMF 2026
            </p>
            <h2 className="text-[18px] font-semibold tracking-tight">Заявка принята</h2>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 text-lg">
            ✓
          </div>
        </div>

        <p className="text-[13px] leading-relaxed text-text-muted">
          Ваш релиз передан в отдел модерации OMF. Мы уведомим вас о начале отгрузки.
        </p>

        <div className="mt-3 rounded-[18px] border border-white/[0.08] bg-black/30 px-4 py-3 text-[13px] backdrop-blur-md">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40 mb-1">Краткое резюме</p>
          <p className="text-[14px] font-medium text-white">
            {summary.artistName} — {summary.releaseName ?? summary.trackName}
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            onClick={onGoHome}
            className="inline-flex h-[48px] w-full items-center justify-center rounded-[18px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[14px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.45)] transition-all"
          >
            На главную
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={onUploadAnother}
            className="inline-flex h-[48px] w-full items-center justify-center rounded-[18px] border border-white/[0.14] bg-white/[0.04] text-[14px] font-semibold text-white/90 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all hover:bg-white/[0.07]"
          >
            Создать новый релиз
          </motion.button>
          <p className="text-center text-[10px] tracking-[0.26em] text-white/28 uppercase">
            OMF DISTRIBUTION • 2026
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
