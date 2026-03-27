"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useHaptics } from "@/lib/hooks/useHaptics";
import { useWalletStats } from "@/lib/hooks/useWalletStats";
import { mockWalletStats } from "@/lib/debug/mock-wallet-stats";
import {
  holdingPeriodUserMessage,
  MIN_WITHDRAW_RUB
} from "@/lib/wallet-payout-policy";
import type { WalletTransactionRow, WalletTransactionStatus } from "@/types/wallet";

/**
 * UI debugging: set `NEXT_PUBLIC_DEBUG_MOCK_WALLET=1` in `.env.local` to skip API/SWR and use
 * {@link mockWalletStats}. Omit or set to `0` for production behavior.
 */
const USE_MOCK_WALLET_UI = process.env.NEXT_PUBLIC_DEBUG_MOCK_WALLET === "1";

function formatRub(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

const TX_STATUS_RU: Record<WalletTransactionStatus, string> = {
  pending: "В обработке",
  completed: "Завершено",
  failed: "Ошибка"
};

function BalanceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-[140px] w-full animate-pulse rounded-[24px] bg-white/[0.06]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[68px] w-full animate-pulse rounded-[18px] bg-white/[0.04]" />
      ))}
    </div>
  );
}

/** Lovable WalletPage.tsx row shape + RUB + real tx data */
function TransactionRow({ tx, index = 0 }: { tx: WalletTransactionRow; index?: number }) {
  const amount = parseFloat(tx.amount);
  const isCredit = amount >= 0;

  return (
    <motion.div
      className="glass-glow glass-glow-charged flex items-center gap-4 p-4"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 + index * 0.06 }}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          isCredit ? "bg-emerald-400/[0.06]" : "bg-red-400/[0.06]"
        }`}
        style={{
          boxShadow: isCredit
            ? "0 0 16px rgba(52,211,153,0.08)"
            : "0 0 16px rgba(248,113,113,0.08)"
        }}
      >
        {isCredit ? (
          <ArrowDownLeft size={16} className="text-emerald-400/70" />
        ) : (
          <ArrowUpRight size={16} className="text-red-400/70" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white/75">{tx.description ?? "Операция"}</p>
        <p className="mt-0.5 text-[10px] text-white/20">
          {formatDateShort(tx.created_at)} · {TX_STATUS_RU[tx.status]}
        </p>
      </div>
      <p
        className={`shrink-0 font-display text-sm font-extrabold tracking-tight ${
          isCredit ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {isCredit ? "+" : ""}
        {formatRub(amount)}
      </p>
    </motion.div>
  );
}

export default function WalletPage() {
  const haptics = useHaptics();
  const { data, error, isLoading } = useWalletStats();

  const walletData = USE_MOCK_WALLET_UI ? mockWalletStats : data ?? null;
  const showSkeleton = !USE_MOCK_WALLET_UI && isLoading;
  const showError = !USE_MOCK_WALLET_UI && Boolean(error) && !isLoading;
  const showContent = walletData != null;

  const canWithdraw = useMemo(
    () => walletData && walletData.available_balance >= MIN_WITHDRAW_RUB,
    [walletData]
  );

  return (
    <div className="min-h-[100dvh] px-5 pb-44 pt-14 text-foreground">
      <motion.h1
        className="mb-10 font-display text-2xl font-bold tracking-tight text-white/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        Кошелёк
      </motion.h1>

      <AnimatePresence mode="wait">
        {showSkeleton && (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <BalanceSkeleton />
          </motion.div>
        )}

        {showError && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-[20px] border border-rose-500/30 bg-rose-950/40 px-5 py-5 text-center"
          >
            <p className="text-[14px] font-medium text-rose-200">Не удалось загрузить данные кошелька</p>
            <p className="mt-1 text-[12px] text-rose-300/70">
              {error instanceof Error ? error.message : "Попробуйте обновить страницу."}
            </p>
          </motion.div>
        )}

        {showContent && (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div
              className="glass-glow glass-glow-charged mb-12 p-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/20">
                Доступно к выводу
              </p>
              <p className="mb-4 font-display text-5xl font-extrabold leading-none tracking-tighter gradient-text-gold">
                {formatRub(walletData.available_balance)}
              </p>
              <p className="mb-8 text-[11px] text-white/35">
                Всего на счёте:{" "}
                <span className="font-semibold text-white/60">{formatRub(walletData.total_balance)}</span>
              </p>
              <p className="mb-6 text-[11px] leading-relaxed text-white/30">{holdingPeriodUserMessage()}</p>
              <motion.button
                type="button"
                disabled={!canWithdraw}
                whileTap={canWithdraw ? { scale: 0.97 } : undefined}
                onClick={() => {
                  if (canWithdraw) haptics.impactLight();
                }}
                className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #818cf8, #c084fc)",
                  boxShadow: "0 0 24px rgba(129,140,248,0.25)"
                }}
              >
                Запросить вывод
              </motion.button>
              {!canWithdraw && (
                <p className="mt-2 text-center text-[11px] text-white/40">
                  Минимум для вывода: {formatRub(MIN_WITHDRAW_RUB)}
                </p>
              )}
              <p className="mt-2 text-center text-[10px] text-white/25">
                Функция вывода будет доступна в следующем обновлении
              </p>
            </motion.div>

            <h2 className="mb-6 font-display text-sm font-bold tracking-tight text-white/50">Транзакции</h2>
            <div className="flex flex-col gap-3">
              {walletData.recent_transactions.length > 0 ? (
                walletData.recent_transactions.map((tx, i) => (
                  <TransactionRow key={tx.id} tx={tx} index={i} />
                ))
              ) : (
                <p className="py-8 text-center text-sm text-white/35">Транзакций пока нет</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
