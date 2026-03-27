"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Clock, Wallet } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { fetchWalletStats } from "@/lib/fetch-wallet-stats";
import {
  holdingPeriodUserMessage,
  MIN_WITHDRAW_RUB
} from "@/lib/wallet-payout-policy";
import type { WalletTransactionRow, WalletTransactionType } from "@/types/wallet";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRub(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

const TX_TYPE_LABEL: Record<WalletTransactionType, string> = {
  royalty: "Роялти",
  payout: "Вывод",
  bonus: "Бонус"
};

const TX_TYPE_COLOR: Record<WalletTransactionType, string> = {
  royalty: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
  payout: "text-rose-300 border-rose-500/30 bg-rose-500/10",
  bonus: "text-violet-300 border-violet-500/30 bg-violet-500/10"
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function BalanceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-[140px] w-full animate-pulse rounded-[24px] bg-white/[0.06]" />
      <div className="h-[80px] w-full animate-pulse rounded-[20px] bg-white/[0.04]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[68px] w-full animate-pulse rounded-[18px] bg-white/[0.04]" />
      ))}
    </div>
  );
}

function TransactionRow({ tx }: { tx: WalletTransactionRow }) {
  const amount = parseFloat(tx.amount);
  const isCredit = amount >= 0;
  const Icon = isCredit ? ArrowDownLeft : ArrowUpRight;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-[18px] border border-white/[0.06] bg-surface/60 px-4 py-3 backdrop-blur-sm"
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
          isCredit
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-rose-500/30 bg-rose-500/10 text-rose-400"
        }`}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-white/90">
          {tx.description ?? TX_TYPE_LABEL[tx.type]}
        </p>
        <p className="text-[11px] text-white/45">{formatDate(tx.created_at)}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`text-[14px] font-semibold ${
            isCredit ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {isCredit ? "+" : ""}
          {formatRub(amount)}
        </span>
        <span
          className={`inline-block rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide ${TX_TYPE_COLOR[tx.type]}`}
        >
          {TX_TYPE_LABEL[tx.type]}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const { data, error, isLoading } = useSWR("wallet-stats", fetchWalletStats, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000
  });

  const canWithdraw = useMemo(
    () => data && data.available_balance >= MIN_WITHDRAW_RUB,
    [data]
  );

  return (
    <div className="min-h-[100dvh] bg-background px-5 py-6 pb-28 text-text">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-5 font-sans">

        {/* Header */}
        <div className="sticky top-0 z-40 -mx-5 border-b border-white/[0.06] bg-black/40 px-5 py-5 backdrop-blur-xl backdrop-saturate-150">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5">
              <Wallet className="h-4 w-4 text-white/80" strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold tracking-tight">Кошелёк</h1>
              <p className="text-[11px] text-white/40">Баланс и история выплат</p>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <BalanceSkeleton />
            </motion.div>
          )}

          {error && !isLoading && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-[20px] border border-rose-500/30 bg-rose-950/40 px-5 py-5 text-center"
            >
              <p className="text-[14px] font-medium text-rose-200">
                Не удалось загрузить данные кошелька
              </p>
              <p className="mt-1 text-[12px] text-rose-300/70">
                {error instanceof Error ? error.message : "Попробуйте обновить страницу."}
              </p>
            </motion.div>
          )}

          {data && !isLoading && (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-4"
            >
              {/* Balance card */}
              <GlassCard className="overflow-hidden p-0">
                <div className="relative px-5 py-6">
                  {/* Background glow */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-30"
                    style={{
                      background:
                        "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(99,102,241,0.4), transparent)"
                    }}
                    aria-hidden
                  />
                  <p className="relative text-[11px] uppercase tracking-[0.2em] text-white/50">
                    Общий баланс
                  </p>
                  <p className="relative mt-1 text-[36px] font-bold tracking-tight text-white">
                    {formatRub(data.total_balance)}
                  </p>

                  <div className="relative mt-4 h-px w-full bg-white/[0.08]" />

                  <div className="relative mt-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">
                        Доступно к выводу
                      </p>
                      <p
                        className={`mt-0.5 text-[22px] font-semibold ${
                          canWithdraw ? "text-emerald-300" : "text-white/70"
                        }`}
                      >
                        {formatRub(data.available_balance)}
                      </p>
                    </div>
                    {data.pending_withdrawals > 0 && (
                      <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
                        <Clock className="h-3 w-3 text-amber-400" />
                        <span className="text-[11px] text-amber-300">
                          {formatRub(data.pending_withdrawals)} на обработке
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="relative mt-3 text-[11px] leading-relaxed text-white/35">
                    {holdingPeriodUserMessage()}
                  </p>
                </div>
              </GlassCard>

              {/* Payout CTA */}
              <div className="rounded-[20px] border border-white/[0.08] bg-surface/60 px-5 py-4 backdrop-blur-sm">
                <button
                  type="button"
                  disabled={!canWithdraw}
                  className="inline-flex h-[52px] w-full items-center justify-center rounded-[16px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[15px] font-semibold text-white shadow-[0_12px_32px_rgba(88,80,236,0.5)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  Запросить вывод
                </button>
                {!canWithdraw && (
                  <p className="mt-2 text-center text-[11px] text-white/40">
                    Минимум для вывода: {formatRub(MIN_WITHDRAW_RUB)}
                  </p>
                )}
                <p className="mt-2 text-center text-[10px] text-white/25">
                  Функция вывода будет доступна в следующем обновлении
                </p>
              </div>

              {/* Transactions */}
              {data.recent_transactions.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <h2 className="px-1 text-[11px] uppercase tracking-[0.18em] text-white/45">
                    Последние транзакции
                  </h2>
                  {data.recent_transactions.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-[20px] border border-white/[0.06] bg-surface/40 px-5 py-10 text-center">
                  <Wallet className="mb-3 h-10 w-10 text-white/20" strokeWidth={1.2} />
                  <p className="text-[14px] font-medium text-white/50">Транзакций пока нет</p>
                  <p className="mt-1 text-[12px] text-white/30">
                    Здесь появятся роялти и история выплат
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
