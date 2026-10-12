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
            className="absolute inset-0 bg-black/60"
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
            className="relative z-10 mx-auto w-full max-w-md rounded-t-[24px] border border-b-0 border-omf-line bg-omf-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-omf-line-strong" aria-hidden />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="admin-approve-smart-title" className="text-[20px] font-bold tracking-tight">
                  Одобрить релиз
                </h2>
                <p className="mt-1 text-[14px] leading-relaxed text-omf-graphite">
                  Вставь ссылку на релиз на всех площадках. Артист получит её в Telegram, а релиз
                  получит статус «одобрен».
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => onClose()}
                aria-label="Закрыть"
                className="omf-focus -mr-1 rounded-full p-1.5 text-omf-graphite hover:bg-omf-surface-2 hover:text-omf-ink disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label htmlFor="admin-smart-link" className="mt-5 block text-[13px] text-omf-graphite">
              Ссылка на релиз
            </label>
            <input
              id="admin-smart-link"
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
              className={`mt-2 min-h-[52px] w-full rounded-control border bg-omf-bg px-4 py-3 text-[16px] text-omf-ink outline-none placeholder:text-omf-faint focus:border-omf-ultra disabled:opacity-50 ${
                localError ? "border-omf-red" : "border-omf-line"
              }`}
            />
            {localError && <p className="mt-2 text-[14px] text-omf-red">{localError}</p>}

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button type="button" disabled={busy} onClick={() => onClose()} className="omf-btn-secondary w-full disabled:opacity-50">
                Отмена
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const t = smartLink.trim();
                  if (!t) {
                    setLocalError("Вставь ссылку на релиз.");
                    return;
                  }
                  try {
                    const u = new URL(t);
                    if (u.protocol !== "https:" && u.protocol !== "http:") {
                      setLocalError("Ссылка должна начинаться с http:// или https://");
                      return;
                    }
                  } catch {
                    setLocalError("Это не похоже на ссылку. Проверь, что скопировал её целиком.");
                    return;
                  }
                  setLocalError(null);
                  onSubmit(releaseId, "RELEASED", t);
                }}
                className="omf-btn-primary w-full"
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
