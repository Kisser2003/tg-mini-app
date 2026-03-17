"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ReleaseForm } from "../components/ReleaseForm";
import { SuccessScreen } from "../components/SuccessScreen";
import { getTelegramUserDisplayName, initTelegramWebApp } from "@/lib/telegram";

function OMFBrand() {
  return (
    <span
      className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-[15px] font-semibold tracking-[0.28em] text-transparent"
      style={{ letterSpacing: "0.28em" }}
    >
      OMF 2026
    </span>
  );
}

type SuccessSummary = {
  artistName: string;
  trackName: string;
};

export default function HomePage() {
  const [step, setStep] = useState<"welcome" | "form" | "success">("welcome");
  const [telegramName, setTelegramName] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<SuccessSummary | null>(null);

  useEffect(() => {
    initTelegramWebApp();
    setTelegramName(getTelegramUserDisplayName());
  }, []);

  const handleStart = () => setStep("form");
  const handleSubmitted = (summary: SuccessSummary) => {
    setSuccessSummary(summary);
    setStep("success");
  };
  const handleReset = () => setStep("form");

  return (
    <div className="min-h-screen bg-background px-5 py-6 pb-10 text-text">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-6 font-sans">
        {/* Compact top bar: OMF branding + greeting */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-3"
        >
          <OMFBrand />
          {telegramName && (
            <p className="text-[12px] text-text-muted truncate max-w-[180px]">
              Привет, {telegramName}!
            </p>
          )}
        </motion.header>

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
              <div className="rounded-[24px] bg-surface/80 px-6 py-7 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                <div className="mb-4 text-4xl">🚀</div>
                <h2 className="mb-2 text-[18px] font-semibold tracking-tight text-text">
                  Готовы к отгрузке?
                </h2>
                <p className="text-[14px] leading-relaxed text-text-muted">
                  Заполните метаданные и загрузите файлы — займёт пару минут.
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.96 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                onClick={handleStart}
                className="btn-primary inline-flex h-[60px] w-full items-center justify-center rounded-[20px] bg-gradient-to-tr from-[#007AFF] to-[#0051FF] text-[17px] font-semibold text-white shadow-[0_10px_30px_rgba(0,122,255,0.45)] transition-all"
              >
                Начать
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
              <SuccessScreen onReset={handleReset} summary={successSummary ?? undefined} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

