"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { hapticMap } from "@/lib/haptic-map";
import { SPRING_UI } from "@/lib/motion-spring";

type Props = {
  /** Что удаляем; null — шторка закрыта. */
  target: { title: string; artist: string; accepted: boolean } | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * Подтверждение удаления релиза (тестовые, дубли). Необратимо: строка, треки и файлы.
 * Артисту ничего не уходит.
 */
export function AdminDeleteReleaseSheet({ target, busy, onClose, onConfirm }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Портал: у обёртки страницы есть transform, и `fixed` внутри неё оказывается под нижней навигацией.
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {target && (
        <motion.div
          className="fixed inset-0 z-[110] flex flex-col justify-end"
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
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="admin-delete-title"
            aria-describedby="admin-delete-body"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SPRING_UI}
            className="relative z-10 mx-auto flex w-full max-w-md flex-col rounded-t-[24px] border border-b-0 border-omf-line bg-omf-surface sm:mb-6 sm:rounded-[24px] sm:border-b"
          >
            <div className="px-5 pt-5">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-omf-line-strong sm:hidden" aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <h2 id="admin-delete-title" className="min-w-0 text-[20px] font-bold tracking-tight">
                  Удалить «{target.title}»?
                </h2>
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
              <div id="admin-delete-body" className="mt-1.5 space-y-2 text-[14px] leading-relaxed text-omf-graphite">
                <p>
                  {target.artist} · релиз, треки, обложка и WAV удалятся насовсем. Вернуть не получится. Артисту
                  ничего не придёт.
                </p>
                {target.accepted ? (
                  <p className="text-omf-yellow">
                    Релиз уже принят. С площадок он не пропадёт — удалится только у нас.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5 border-t border-omf-line px-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => onClose()}
                className="omf-btn-secondary w-full disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  hapticMap.notificationWarning();
                  onConfirm();
                }}
                className="omf-btn-ink w-full bg-omf-red text-white disabled:opacity-50"
              >
                {busy ? "Удаляем…" : "Удалить"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
