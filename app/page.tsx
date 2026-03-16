"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ReleaseForm } from "@/components/ReleaseForm";
import { SuccessScreen } from "@/components/SuccessScreen";
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
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-1"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Telegram Mini App
          </p>
          <span
            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
              isTelegram
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-amber-500/20 text-amber-200"
            }`}
          >
            {isTelegram ? "Telegram OK" : "Browser Preview"}
          </span>
        </div>
        <h1 className="text-xl font-semibold">
          Отправить релиз на дистрибуцию
        </h1>
        <p className="text-xs text-zinc-400">
          Загрузите трек и обложку — мы передадим релиз на дистрибуцию и
          свяжемся с вами.
        </p>
        {telegramName && (
          <p className="text-xs text-zinc-500">Вы вошли как {telegramName}</p>
        )}
      </motion.div>

      {step === "welcome" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="space-y-4 pt-2"
        >
          <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-emerald-500/10 via-zinc-900 to-indigo-500/10 p-4">
            <p className="text-sm font-medium text-zinc-50">
              Отправить релиз на дистрибуцию
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Минимум полей — максимум скорости. Идеально для Telegram.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStart}
            className="flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 transition"
          >
            Загрузить релиз
          </motion.button>
        </motion.div>
      )}

      {step === "form" && <ReleaseForm onSubmitted={handleSubmitted} />}

      {step === "success" && <SuccessScreen onReset={handleReset} />}
    </div>
  );
}

