"use client";

import { useState } from "react";
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
    key: "title",
    label: "Название и имена",
    message:
      "Поправьте название релиза, треков или имя артиста: уберите эмодзи, лишние символы и промо-слова (например, «FREE DOWNLOAD»)."
  },
  {
    key: "explicit",
    label: "Метка explicit",
    message:
      "Метка explicit не соответствует содержанию: отметьте нецензурные треки или уберите метку, если мата нет."
  },
  {
    key: "links",
    label: "Ссылки артиста",
    message:
      "Ссылки на профили артиста указаны неверно или не открываются. Проверьте и исправьте их."
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
  onSelectReason: (releaseId: string, reason: string, reasonKey?: string) => void;
};

export function AdminRejectModal({ releaseId, busy, onClose, onSelectReason }: Props) {
  const open = releaseId != null;
  const [custom, setCustom] = useState("");
  const customTrimmed = custom.trim();

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
            className="relative z-10 mx-auto w-full max-w-md rounded-t-[24px] border border-b-0 border-omf-line bg-omf-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-omf-line-strong" aria-hidden />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="admin-reject-title" className="text-[20px] font-bold tracking-tight">
                  Почему возвращаешь релиз
                </h2>
                <p className="mt-1 text-[14px] leading-relaxed text-omf-graphite">
                  Нажми на причину. Релиз сразу вернётся артисту, и он увидит этот текст.
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

            <div className="mt-4 flex flex-col">
              {ADMIN_REJECT_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  disabled={busy || releaseId == null}
                  onClick={() => {
                    if (releaseId == null) return;
                    hapticMap.impactLight();
                    onSelectReason(releaseId, p.message, p.key);
                  }}
                  className="omf-focus border-t border-omf-line py-3.5 text-left transition-colors hover:bg-omf-surface-2 disabled:opacity-50"
                >
                  <span className="block text-[16px] font-medium text-omf-ink">{p.label}</span>
                  <span className="mt-0.5 block text-[14px] leading-snug text-omf-graphite">{p.message}</span>
                </button>
              ))}
            </div>

            <div className="border-t border-omf-line pt-3.5">
              <label htmlFor="admin-reject-custom" className="block text-[14px] font-medium text-omf-ink">
                Своя причина
              </label>
              <textarea
                id="admin-reject-custom"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                maxLength={1000}
                rows={3}
                disabled={busy}
                placeholder="Что именно нужно исправить"
                className="omf-focus mt-2 w-full rounded-control border border-omf-line bg-omf-surface-2 px-3 py-2.5 text-[15px] text-omf-ink outline-none placeholder:text-omf-faint focus:border-omf-ultra"
              />
              <button
                type="button"
                disabled={busy || releaseId == null || customTrimmed.length < 5}
                onClick={() => {
                  if (releaseId == null) return;
                  hapticMap.impactLight();
                  onSelectReason(releaseId, customTrimmed, "custom");
                  setCustom("");
                }}
                className="omf-btn-secondary mt-2 w-full disabled:opacity-50"
              >
                Вернуть с этой причиной
              </button>
            </div>

            {busy && <p className="mt-4 text-center text-[14px] text-omf-graphite">Отправляем артисту…</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
