"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/api/get-telegram-init-data-from-request";
import { getTelegramWebApp, triggerHaptic } from "@/lib/telegram";
import { usePathname } from "next/navigation";

export function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) setText("");
  }, [open]);

  const submit = useCallback(async () => {
    const msg = text.trim();
    if (!msg) {
      toast.error("Напиши пару слов о том, что улучшить.");
      return;
    }
    setSending(true);
    try {
      const initData = getTelegramWebApp()?.initData;
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      if (initData) headers.set(TELEGRAM_INIT_DATA_HEADER, initData);

      const res = await fetch("/api/feedback", {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({ message: msg, route: pathname })
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(
          data.error ?? "Не удалось отправить отзыв. Проверьте соединение и попробуйте ещё раз."
        );
      }
      toast.success("Спасибо! Мы прочитаем отзыв.");
      setOpen(false);
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось отправить");
    } finally {
      setSending(false);
    }
  }, [text, pathname]);

  return (
    <>
      <motion.button
        type="button"
        aria-label="Обратная связь"
        onClick={() => {
          triggerHaptic("medium");
          setOpen(true);
        }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-4 z-[45] flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white shadow-[0_14px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl backdrop-saturate-150"
      >
        <MessageCircle className="h-5 w-5 text-violet-200" strokeWidth={2} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-sm sm:items-center"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
              className="w-full max-w-[400px] rounded-[24px] border border-white/12 bg-[#0a0a0a]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.75)] backdrop-blur-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="feedback-title" className="text-lg font-semibold tracking-tight">
                    Обратная связь
                  </h2>
                  <p className="mt-1 text-[13px] text-white/50">
                    Что улучшить в приложении? Мы читаем каждое сообщение.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Закрыть"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-white/10 p-2 text-white/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Например: удобнее сделать кнопку вывода…"
                className="mt-4 w-full resize-none rounded-[18px] border border-white/[0.08] bg-black/40 px-4 py-3 text-[15px] leading-relaxed text-white outline-none placeholder:text-white/35 focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20"
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-white/15 py-3 text-sm font-medium text-white/80"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void submit()}
                  className="flex-1 rounded-xl bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.45)] disabled:opacity-50"
                >
                  {sending ? "Отправка…" : "Отправить"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
