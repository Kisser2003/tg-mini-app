"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { SPRING_UI } from "@/lib/motion-spring";

type Props = {
  releaseId: string | null;
  busy: boolean;
  onClose: () => void;
  /** newStatus уходит на API (например RELEASED); smartLink — публичный URL. */
  onSubmit: (releaseId: string, newStatus: string, smartLink: string) => void;
};

export function AdminApproveSmartLinkModal({ releaseId, busy, onClose, onSubmit }: Props) {
  const open = releaseId != null;
  const [smartLink, setSmartLink] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSmartLink("");
      setLocalError(null);
    }
  }, [open, releaseId]);

  return (
    <AnimatePresence>
      {open && releaseId && (
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
            aria-labelledby="admin-approve-smart-title"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SPRING_UI}
            className="relative z-10 mx-auto w-full max-w-md rounded-t-[28px] border border-white/[0.12] border-b-0 bg-zinc-950/90 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-[0_-12px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" aria-hidden />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="admin-approve-smart-title" className="text-lg font-semibold text-white">
                  Выпуск + Smart Link
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-white/55">
                  Статус в каталоге станет «выпущен» (<code className="text-white/70">ready</code> в БД).
                  Укажите публичную ссылку для артиста.
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

            <label className="mt-4 block text-[11px] font-medium uppercase tracking-[0.12em] text-white/45">
              Smart Link (https)
            </label>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              disabled={busy}
              value={smartLink}
              onChange={(e) => {
                setSmartLink(e.target.value);
                setLocalError(null);
              }}
              placeholder="https://ffm.to/…"
              className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-black/30 px-4 py-3 text-[16px] text-white outline-none placeholder:text-white/40 focus:ring-2 focus:ring-emerald-500/25 disabled:opacity-50"
            />
            {localError && (
              <p className="mt-2 text-[12px] text-rose-300">{localError}</p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onClose()}
                className="flex-1 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-medium text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const t = smartLink.trim();
                  if (!t) {
                    setLocalError("Введите ссылку.");
                    return;
                  }
                  try {
                    const u = new URL(t);
                    if (u.protocol !== "https:" && u.protocol !== "http:") {
                      setLocalError("Нужна ссылка http(s).");
                      return;
                    }
                  } catch {
                    setLocalError("Некорректный URL.");
                    return;
                  }
                  setLocalError(null);
                  onSubmit(releaseId, "RELEASED", t);
                }}
                className="flex-1 rounded-xl border border-emerald-400/40 bg-emerald-500/25 py-3 text-sm font-semibold text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.25)] disabled:opacity-50"
              >
                {busy ? "Сохраняем…" : "Одобрить"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
