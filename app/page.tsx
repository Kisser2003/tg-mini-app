"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ReleaseForm } from "../components/ReleaseForm";
import { SuccessScreen } from "../components/SuccessScreen";
import {
  getTelegramUserDisplayName,
  initTelegramWebApp,
  isTelegramMiniApp
} from "@/lib/telegram";

export default function HomePage() {
  const [step, setStep] = useState<"welcome" | "form" | "success">("welcome");
  const [isTelegram, setIsTelegram] = useState(false);
  const [telegramName, setTelegramName] = useState<string | null>(null);

  useEffect(() => {
    const webApp = initTelegramWebApp();
    setIsTelegram(Boolean(webApp && isTelegramMiniApp()));
    setTelegramName(getTelegramUserDisplayName());
  }, []);

  const handleStart = () => setStep("form");
  const handleSubmitted = () => setStep("success");
  const handleReset = () => setStep("form");

  return (
    <div className="min-h-screen bg-background px-5 py-8 pb-8 text-text">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-6 font-sans">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
                Telegram Mini App
              </p>
              <h1 className="text-[26px] font-extrabold tracking-[-0.04em] text-text">
                Release Assistant
              </h1>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                isTelegram
                  ? "border border-[#007AFF] bg-[rgba(0,122,255,0.14)] text-[#007AFF]"
                  : "border border-amber-400/80 bg-amber-500/10 text-amber-300"
              }`}
            >
              {isTelegram ? "TELEGRAM OK" : "BROWSER"}
            </div>
          </div>

          <p className="text-[13px] leading-relaxed text-text-muted">
            Загрузите трек и обложку — мы передадим релиз на дистрибуцию и
            свяжемся с вами.
          </p>

          {telegramName && (
            <p className="text-[12px] font-medium text-primary leading-relaxed">
              Привет, {telegramName}!
            </p>
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="space-y-5 text-center"
            >
              <div className="rounded-[24px] border border-white/5 bg-surface/80 px-6 py-7 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                <div className="mb-4 text-4xl">🚀</div>
                <h2 className="mb-2 text-[18px] font-semibold tracking-tight text-text">
                  Готовы к релизу?
                </h2>
                <p className="text-[14px] leading-relaxed text-text-muted">
                  Минимум полей — максимум скорости. <br />
                  Загрузка займет всего пару минут.
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleStart}
                className="btn-primary inline-flex h-[60px] w-full items-center justify-center rounded-[20px] bg-gradient-to-tr from-[#007AFF] to-[#0051FF] text-[17px] font-semibold text-white shadow-[0_10px_30px_rgba(0,122,255,0.45)] transition-all active:scale-[0.97]"
              >
                Начать загрузку
              </motion.button>
            </motion.div>
          )}

          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <ReleaseForm onSubmitted={handleSubmitted} />
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="pt-10 text-center"
            >
              <SuccessScreen onReset={handleReset} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

