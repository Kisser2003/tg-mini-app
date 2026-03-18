"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getTelegramUserDisplayName } from "@/lib/telegram";

export default function WelcomePage() {
  const router = useRouter();
  const [telegramName, setTelegramName] = useState<string | null>(null);

  useEffect(() => {
    setTelegramName(getTelegramUserDisplayName());
  }, []);

  return (
    <div className="min-h-screen bg-background px-5 py-6 pb-10 text-text">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-8 font-sans">
        <header className="flex items-center justify-between gap-3">
          <span
            className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-[15px] font-semibold tracking-[0.28em] text-transparent"
            style={{ letterSpacing: "0.28em" }}
          >
            OMF 2026
          </span>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div className="space-y-3">
            <div className="text-[14px] text-text-muted">
              {telegramName ? `Привет, ${telegramName}!` : "Привет!"}
            </div>
            <h1 className="text-[22px] font-semibold tracking-tight">
              Добро пожаловать в OMF 2026.
            </h1>
            <p className="text-[14px] text-text-muted leading-relaxed">
              Управляй своими релизами, загружай новые треки и следи за статусом прямо в
              Telegram.
            </p>
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            onClick={() => router.push("/dashboard")}
            className="mt-4 inline-flex h-[60px] w-full items-center justify-center rounded-[20px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[17px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.6)]"
          >
            Начать
          </motion.button>
        </main>
      </div>
    </div>
  );
}

