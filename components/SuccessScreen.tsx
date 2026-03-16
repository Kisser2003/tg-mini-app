import { motion } from "framer-motion";

type Props = {
  onReset: () => void;
  summary?: {
    artistName?: string;
    trackName?: string;
  };
};

export function SuccessScreen({ onReset, summary }: Props) {
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
        className="w-full max-w-[420px] rounded-[24px] bg-surface/90 px-6 py-6 shadow-[0_22px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl border border-white/8 text-left space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-[0.26em] text-white/40 uppercase">
              OMF 2026
            </p>
            <h2 className="text-[18px] font-semibold tracking-tight">
              Заявка принята
            </h2>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-400/40 text-emerald-300 text-lg">
            ✓
          </div>
        </div>

        <p className="text-[13px] leading-relaxed text-text-muted">
          Ваш релиз передан в отдел модерации OMF. Мы уведомим вас о начале
          отгрузки.
        </p>

        <div className="mt-3 rounded-[18px] border border-white/8 bg-black/30 px-4 py-3 text-[13px]">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40 mb-1">
            КРАТКОЕ РЕЗЮМЕ
          </p>
          <p className="text-[14px] font-medium text-white">
            {summary?.artistName || "Артист"} — {summary?.trackName || "Трек"}
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <button
            onClick={onReset}
            className="btn-primary inline-flex h-[46px] w-full items-center justify-center rounded-[18px] bg-gradient-to-tr from-[#007AFF] to-[#0051FF] text-[14px] font-semibold text-white shadow-[0_10px_30px_rgba(0,122,255,0.45)] transition-all"
          >
            Оформить ещё поставку
          </button>
          <p className="text-center text-[10px] tracking-[0.26em] text-white/28 uppercase">
            OMF DISTRIBUTION • 2026
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

