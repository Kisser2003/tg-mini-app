"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import confetti from "canvas-confetti";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { triggerHaptic } from "@/lib/telegram";
import { useReferral } from "@/lib/hooks/useReferral";
import { REFEREE_DISCOUNT_RUB, formatRub } from "@/lib/referral";
import { SPRING_UI } from "@/lib/motion-spring";

const SEEN_KEY = "omf:referral-welcome-seen";

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* без localStorage покажем снова при следующем входе — не страшно */
  }
}

function celebrate(): void {
  const colors = ["#f5d90a", "#8c9bff", "#2f3fe0", "#ffffff"];
  const base = { colors, disableForReducedMotion: true, zIndex: 10_000 };
  void confetti({ ...base, particleCount: 80, spread: 70, startVelocity: 38, origin: { y: 0.4 } });
  window.setTimeout(() => {
    void confetti({ ...base, particleCount: 45, angle: 60, spread: 55, origin: { x: 0.1, y: 0.7 } });
    void confetti({ ...base, particleCount: 45, angle: 120, spread: 55, origin: { x: 0.9, y: 0.7 } });
  }, 250);
}

/** Скидка друга по приглашению ждёт первого релиза — для плашки в пустом экране. */
export function useReferralDiscountPending(): boolean {
  const { data } = useReferral();
  return Boolean(data?.hasPendingDiscount);
}

/**
 * Приветствие для друга, пришедшего по реферальной ссылке: один раз, при первом входе,
 * пока скидка не использована. `onCreate` — переход к созданию релиза.
 */
export function ReferralWelcome({ onCreate }: { onCreate: () => void }) {
  const { data } = useReferral();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const shouldShow = Boolean(data?.hasPendingDiscount);
  useEffect(() => {
    if (!shouldShow || readSeen()) return;
    setOpen(true);
    triggerHaptic("success");
    const t = window.setTimeout(celebrate, 350);
    return () => window.clearTimeout(t);
  }, [shouldShow]);

  const close = useCallback(() => {
    writeSeen();
    setOpen(false);
  }, []);

  const create = useCallback(() => {
    close();
    onCreate();
  }, [close, onCreate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // В body, а не в потоке страницы: transform у PageTransition запирает z-index внутри себя,
  // и кнопка «+» с нижним меню оказываются поверх экрана.
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col bg-omf-bg px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(48px,env(safe-area-inset-top))]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="referral-welcome-title"
        >
          <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col">
            <motion.div
              className="text-center"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SPRING_UI}
            >
              <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-omf-ultra-text">Тебе подарок</p>
              <h1
                id="referral-welcome-title"
                className="mt-3 text-[30px] font-extrabold leading-[0.98] tracking-[-0.04em] text-omf-ink"
              >
                Друг дарит скидку на первый релиз
              </h1>
            </motion.div>

            {/* Жёлтый билет с отрывным корешком: влетает сверху и ложится под наклоном. */}
            <motion.div
              className="relative mt-10 flex overflow-hidden rounded-[14px] bg-omf-yellow text-omf-yellow-ink shadow-[0_24px_50px_-18px_rgba(245,217,10,0.45)]"
              initial={reduceMotion ? { rotate: -3 } : { opacity: 0, y: -60, rotate: -14, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, rotate: -3, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
            >
              <div className="flex-1 px-5 py-6">
                <p className="text-[12px] font-bold uppercase tracking-[0.12em] opacity-70">OMF · билет</p>
                <p className="mt-2 text-[60px] font-extrabold leading-none tracking-[-0.06em]">
                  −{formatRub(REFEREE_DISCOUNT_RUB)}
                </p>
                <p className="mt-3 text-[13px] font-bold">на первый выпуск</p>
              </div>
              <div className="relative flex w-[78px] items-center justify-center border-l-2 border-dashed border-omf-yellow-ink/40">
                <span className="-rotate-90 whitespace-nowrap text-[12px] font-extrabold uppercase tracking-[0.18em]">
                  1 релиз
                </span>
                <span aria-hidden className="absolute -left-[11px] -top-[11px] h-5 w-5 rounded-full bg-omf-bg" />
                <span aria-hidden className="absolute -bottom-[11px] -left-[11px] h-5 w-5 rounded-full bg-omf-bg" />
              </div>
            </motion.div>

            <motion.p
              className="mt-10 text-center text-[15px] leading-relaxed text-omf-graphite"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.3 }}
            >
              Ничего вводить не нужно — скидка привязана к твоему Telegram. Студия учтёт её при оплате.
            </motion.p>

            <div className="mt-auto flex flex-col gap-1 pt-8">
              <button type="button" onClick={create} className="omf-btn-primary h-14 w-full text-[16px]">
                Забрать и выпустить релиз
              </button>
              <button type="button" onClick={close} className="omf-focus h-12 w-full text-[15px] font-medium text-omf-graphite">
                Позже
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
