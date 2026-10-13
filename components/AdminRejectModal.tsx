"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { hapticMap } from "@/lib/haptic-map";
import { SPRING_UI } from "@/lib/motion-spring";
import {
  REJECT_REASONS,
  REJECTION_COMMENT_MAX,
  REJECTION_CUSTOM_MIN,
  buildRejection
} from "@/lib/rejection-reasons";
import { cn } from "@/lib/utils";

/** Пресеты причин возврата; общий список с экраном артиста (`lib/rejection-reasons`). */
export const ADMIN_REJECT_PRESETS = REJECT_REASONS;

type Props = {
  open: boolean;
  busy: boolean;
  /** Для массового возврата: «Вернуть 3 релиза». */
  count?: number;
  onClose: () => void;
  /** Текст для артиста и ключи причин (для статистики «частые причины»). */
  onSubmit: (comment: string, reasonKeys: string[]) => void;
};

/**
 * Возврат релиза: можно отметить несколько причин и дописать свою.
 * Артист получит ровно тот текст, что показан в «Артист увидит».
 */
export function AdminRejectModal({ open, busy, count = 1, onClose, onSubmit }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setSelected([]);
      setCustom("");
    }
  }, [open]);

  const rejection = useMemo(() => buildRejection(selected, custom), [selected, custom]);

  const toggle = (key: string) => {
    hapticMap.impactLight();
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const title = count > 1 ? `Вернуть релизы: ${count}` : "Почему возвращаешь релиз";

  // Портал: у обёртки страницы есть transform, и `fixed` внутри неё оказывается под нижней навигацией.
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-reject-title"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SPRING_UI}
            className="relative z-10 mx-auto flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-[24px] border border-b-0 border-omf-line bg-omf-surface sm:mb-6 sm:rounded-[24px] sm:border-b"
          >
            <div className="overflow-y-auto px-5 pt-5">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-omf-line-strong sm:hidden" aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="admin-reject-title" className="text-[20px] font-bold tracking-tight">
                    {title}
                  </h2>
                  <p className="mt-1 text-[14px] leading-relaxed text-omf-graphite">
                    Отметь одну или несколько причин. {count > 1 ? "Все артисты" : "Артист"} получит этот текст
                    в боте и в карточке релиза.
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

              <fieldset className="mt-4" disabled={busy}>
                <legend className="sr-only">Причины</legend>
                {REJECT_REASONS.map((r) => {
                  const on = selected.includes(r.key);
                  return (
                    <button
                      key={r.key}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(r.key)}
                      className="omf-focus flex w-full items-start gap-3 border-t border-omf-line py-3 text-left transition-colors hover:bg-omf-surface-2 disabled:opacity-50"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border",
                          on ? "border-omf-ultra bg-omf-ultra text-white" : "border-omf-line-strong"
                        )}
                        aria-hidden
                      >
                        {on ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[16px] font-medium text-omf-ink">{r.label}</span>
                        <span className="mt-0.5 line-clamp-1 text-[13px] leading-snug text-omf-graphite">{r.message}</span>
                      </span>
                    </button>
                  );
                })}
              </fieldset>

              <div className="border-t border-omf-line pt-3.5">
                <label htmlFor="admin-reject-custom" className="block text-[14px] font-medium text-omf-ink">
                  Своя причина
                </label>
                <textarea
                  id="admin-reject-custom"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  maxLength={REJECTION_COMMENT_MAX}
                  rows={2}
                  disabled={busy}
                  placeholder="Что именно исправить"
                  className="omf-focus mt-2 w-full rounded-control border border-omf-line bg-omf-surface-2 px-3 py-2.5 text-[16px] text-omf-ink outline-none placeholder:text-omf-faint focus:border-omf-ultra"
                />
                {custom.trim().length > 0 && custom.trim().length < REJECTION_CUSTOM_MIN ? (
                  <p className="mt-1 text-[13px] text-omf-faint">Напиши чуть подробнее.</p>
                ) : null}
              </div>

              {rejection ? (
                <div className="mt-3 rounded-control bg-omf-surface-2 p-3">
                  <p className="text-[12px] text-omf-graphite">Артист увидит</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-snug text-omf-ink">
                    {rejection.comment}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="border-t border-omf-line px-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3">
              <button
                type="button"
                disabled={busy || rejection == null}
                onClick={() => {
                  if (!rejection) return;
                  hapticMap.impactLight();
                  onSubmit(rejection.comment, rejection.reasonKeys);
                }}
                className="omf-btn-primary w-full disabled:opacity-50"
              >
                {busy
                  ? "Отправляем артисту…"
                  : rejection == null
                    ? "Выбери причину"
                    : count > 1
                      ? `Вернуть ${count}`
                      : "Вернуть релиз"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
