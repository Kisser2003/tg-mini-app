"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Music4 } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-6 pb-12 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 0.99 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
        className="glass-card flex h-24 w-24 items-center justify-center rounded-[28px]"
      >
        <div className="relative flex items-center justify-center">
          <Music4 className="h-10 w-10 text-white/90" />
          <span className="absolute -bottom-5 text-[11px] font-semibold tracking-[0.2em] text-white/80">
            omf
          </span>
        </div>
      </motion.div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-white/55">OMF</p>
        <h1 className="text-3xl font-semibold tracking-tight">Добро пожаловать</h1>
        <p className="mx-auto max-w-[300px] text-sm leading-relaxed text-white/65">
          Твоя музыка. Твои правила. Твой доход.
        </p>
      </div>

      <motion.button
        type="button"
        whileHover={{ scale: 0.99 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        onClick={() => router.push("/")}
        className="w-full max-w-[300px] rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(168,85,247,0.5)]"
      >
        Войти через Telegram
      </motion.button>
    </div>
  );
}
