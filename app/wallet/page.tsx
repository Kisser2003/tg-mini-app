"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Wallet } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { payoutHistory, walletSummary } from "@/lib/mock-data";

export default function WalletPage() {
  return (
    <div className="flex flex-col gap-4 pb-10">
      <GlassCard className="p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-white/55">Кошелек</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Баланс и выплаты</h1>
      </GlassCard>

      <GlassCard className="p-6 text-center">
        <span className="inline-flex items-center gap-2 text-sm text-white/70">
          <Wallet className="h-4 w-4" />
          Доступный баланс
        </span>
        <p className="mt-3 bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300 bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
          {walletSummary.availableBalance}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-white/60">
          <motion.div
            whileHover={{ scale: 0.995 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur-3xl"
          >
            <p>В обработке</p>
            <p className="mt-1 text-sm text-white/90">{walletSummary.pendingBalance}</p>
          </motion.div>
          <motion.div
            whileHover={{ scale: 0.995 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur-3xl"
          >
            <p>Следующая выплата</p>
            <p className="mt-1 text-sm text-white/90">{walletSummary.nextPayoutDate}</p>
          </motion.div>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 0.99 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 to-emerald-300 px-4 py-3 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(56,189,248,0.35)]"
        >
          <ArrowUpRight className="h-4 w-4" />
          Вывести средства
        </motion.button>
      </GlassCard>

      <GlassCard className="p-5">
        <p className="mb-3 text-sm font-medium tracking-tight text-white/85">История выплат</p>
        <div className="space-y-2">
          {payoutHistory.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 0.995 }}
              whileTap={{ scale: 0.98 }}
              transition={{ delay: index * 0.05, type: "spring", stiffness: 280, damping: 24 }}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 backdrop-blur-3xl"
            >
              <div>
                <p className="text-sm">{item.amount}</p>
                <p className="text-xs text-white/55">{item.date}</p>
              </div>
              <span className="rounded-full border border-emerald-300/35 bg-emerald-500/20 px-2 py-1 text-[10px] text-emerald-100">
                {item.status}
              </span>
            </motion.div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
