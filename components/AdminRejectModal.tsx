"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { hapticMap } from "@/lib/haptic-map";
import { SPRING_UI } from "@/lib/motion-spring";

export const ADMIN_REJECT_PRESETS = [
  {
    key: "caps",
    label: "Верхний регистр",
    message:
      "Пожалуйста, поправьте типографику: избегайте длинных фрагментов В ВЕРХНЕМ РЕГИСТРЕ в названиях и именах."
  },
  {
    key: "quality",
    label: "Качество аудио",
    message:
      "К сожалению, качество записи не подходит для площадок: слышны шум, клиппинг или звук не совпадает с заявленным материалом."
  },
  {
    key: "copyright",
    label: "Авторские права",
    message:
      "Есть сомнения в правах на распространение. Пришлите, пожалуйста, подтверждающие материалы в поддержку."
  },
  {
    key: "artwork",
    label: "Обложка",
    message:
      "Обложка не соответствует требованиям площадок: разрешение, читаемость текста или общее оформление."
  }
] as const;

type Props = {
  releaseId: string | null;
  busy: boolean;
  onClose: () => void;
  /** Вызывается сразу после выбора пресета */
  onSelectReason: (releaseId: string, reason: string) => void;
};

export function AdminRejectModal({ releaseId, busy, onClose, onSelectReason }: Props) {
  const open = releaseId != null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 bg-black/40 backdrop-blur-[30px]"
            onClick={() => !busy && onClose()}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-reject-title"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SPRING_UI}
            className="relative z-10 mx-auto w-full max-w-md rounded-t-[28px] border border-white/[0.12] border-b-0 bg-zinc-950/90 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-[0_-12px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" aria-hidden />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="admin-reject-title" className="text-lg font-semibold text-white">
                  Причина отклонения
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-white/55">
                  Выберите пресет — артист увидит текст в уведомлении.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => onClose()}
                className="rounded-xl border border-white/15 bg-white/5 p-2 text-white/70 hover:bg-white/10 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2">
              {ADMIN_REJECT_PRESETS.map((p) => (
                <motion.button
                  key={p.key}
                  type="button"
                  disabled={busy || releaseId == null}
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING_UI}
                  onClick={() => {
                    if (releaseId == null) return;
                    hapticMap.impactLight();
                    onSelectReason(releaseId, p.message);
                  }}
                  className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-rose-500/15 to-rose-950/40 px-4 py-3 text-left text-[14px] font-medium text-rose-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-rose-400/30 hover:from-rose-500/25 disabled:opacity-50"
                >
                  <span className="text-[11px] uppercase tracking-[0.14em] text-rose-200/80">
                    {p.label}
                  </span>
                  <span className="mt-1 block text-[12px] font-normal leading-snug text-white/75">
                    {p.message}
                  </span>
                </motion.button>
              ))}
            </div>

            {busy && (
              <p className="mt-4 text-center text-[12px] text-white/45">Отправляем…</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
