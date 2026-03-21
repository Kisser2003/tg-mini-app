"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent, useSpring } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Coins,
  Info,
  RefreshCcw,
  Sparkles,
  Wallet
} from "lucide-react";
import useSWR from "swr";
import { GlassCard } from "@/components/GlassCard";
import { MagneticWrapper } from "@/components/MagneticWrapper";
import { PullRefreshBrand } from "@/components/PullRefreshBrand";
import { Skeleton } from "@/components/ui/Skeleton";
import { debugInit } from "@/lib/debug";
import { fetchWalletStats } from "@/lib/fetch-wallet-stats";
import { holdingPeriodUserMessage, MIN_WITHDRAW_RUB } from "@/lib/wallet-payout-policy";
import { getReleaseStatusMeta, normalizeReleaseStatus } from "@/lib/release-status";
import { supabase } from "@/lib/supabase";
import { SPRING_PHYSICS, SPRING_UI } from "@/lib/motion-spring";
import { getTelegramUserId, initTelegramWebApp, triggerHaptic } from "@/lib/telegram";
import { useSafePolling } from "@/lib/useSafePolling";
import type { WalletTransactionRow, WalletTransactionType } from "@/types/wallet";

type ReleasePayoutRow = {
  id: string;
  track_name: string;
  status: string;
  created_at: string;
};

type WalletData = {
  summaryRows: ReleasePayoutRow[];
  recentRows: ReleasePayoutRow[];
};

const listContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 }
  }
};

const listItem = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 320, damping: 28 }
  }
};

function formatMoneyRub(value: number): string {
  return `${value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ₽`;
}

function AnimatedMoneyRub({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const mv = useMotionValue(0);
  const smooth = useSpring(mv, SPRING_PHYSICS);
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  useMotionValueEvent(smooth, "change", (v) => setDisplay(v));
  return <>{formatMoneyRub(display)}</>;
}

function formatTxDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch {
    return iso;
  }
}

function txSignedAmount(tx: WalletTransactionRow): number {
  const raw = Number(tx.amount);
  if (!Number.isFinite(raw)) return 0;
  if (tx.type === "payout") return -Math.abs(raw);
  return Math.abs(raw);
}

function statusLabel(status: WalletTransactionRow["status"]): string {
  if (status === "completed") return "Завершено";
  if (status === "pending") return "В обработке";
  return "Не выполнено";
}

function WalletBalanceBlockSkeleton() {
  return (
    <GlassCard className="relative overflow-hidden border-white/[0.12] p-0">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600/25 via-indigo-600/15 to-purple-600/25" />
      <div className="relative space-y-4 p-6">
        <Skeleton className="h-3 w-40 rounded-md" />
        <Skeleton className="h-12 w-3/4 max-w-[240px] rounded-lg" />
        <Skeleton className="h-3 w-52 rounded-md" />
        <Skeleton className="h-3 w-full rounded-md" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </GlassCard>
  );
}

function WalletTxListSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="rounded-[24px] border border-white/10 bg-white/[0.02] p-3.5 backdrop-blur-3xl"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-[85%] rounded-md" />
              <Skeleton className="h-3 w-24 rounded-md" />
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="ml-auto h-4 w-20 rounded-md" />
              <Skeleton className="ml-auto h-3 w-16 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WalletPage() {
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    debugInit("wallet", "init start");
    initTelegramWebApp();
    setUserId(getTelegramUserId());
    debugInit("wallet", "init done");
  }, []);

  const {
    data: walletStats,
    error: walletError,
    isLoading: walletLoading,
    mutate: mutateWallet
  } = useSWR(userId != null ? "wallet-stats" : null, fetchWalletStats, {
    revalidateOnFocus: false,
    dedupingInterval: 5000
  });

  const loadRows = useCallback(async () => {
    if (userId == null) {
      return { summaryRows: [], recentRows: [] } as WalletData;
    }

    const { data, error: dbError } = await supabase
      .from("releases")
      .select("id, track_name, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (dbError) throw dbError;
    const allRows = (data ?? []) as ReleasePayoutRow[];
    return {
      summaryRows: allRows,
      recentRows: allRows.slice(0, 12)
    };
  }, [userId]);

  const {
    data,
    loading: releasesLoading,
    refreshing,
    error: releasesError,
    reload: loadWithSafety
  } = useSafePolling<WalletData>({
    enabled: userId != null,
    intervalMs: 8000,
    load: loadRows,
    initialData: { summaryRows: [], recentRows: [] },
    requestTimeoutMs: 12000,
    debugName: "wallet.rows"
  });

  const summary = useMemo(() => {
    return data.summaryRows.reduce(
      (acc, row) => {
        const normalized = normalizeReleaseStatus(row.status);
        if (normalized === "processing") acc.pending += 1;
        else if (normalized === "failed") acc.failed += 1;
        return acc;
      },
      { pending: 0, failed: 0 }
    );
  }, [data.summaryRows]);

  const totalBalance = walletStats?.total_balance ?? 0;
  const availableBalance = walletStats?.available_balance ?? 0;
  const pendingWithdrawals = walletStats?.pending_withdrawals ?? 0;
  const recentTx = walletStats?.recent_transactions ?? [];

  const canRequestPayout = availableBalance >= MIN_WITHDRAW_RUB;

  const onWithdrawClick = () => {
    triggerHaptic("light");
  };

  const onRefreshAll = useCallback(() => {
    void mutateWallet();
    void loadWithSafety(true);
  }, [mutateWallet, loadWithSafety]);

  const txIcon = (type: WalletTransactionType) => {
    if (type === "payout") {
      return { Icon: ArrowUpRight, iconBg: "bg-amber-500/20 text-amber-200" as const };
    }
    return { Icon: ArrowDownLeft, iconBg: "bg-emerald-500/20 text-emerald-300" as const };
  };

  const showWalletSkeleton = userId != null && walletLoading && !walletStats;

  return (
    <div className="flex flex-col gap-5 pb-10">
      <PullRefreshBrand />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Кошелёк</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-white/50">
            Баланс и статусы релизов
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <motion.button
            type="button"
            aria-label="Справка по кошельку"
            title="Доступно к выводу — сумма завершённых начислений старше периода удержания. «Всего» — полный баланс по леджеру."
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            className="rounded-xl border border-white/15 bg-white/[0.04] p-2 text-white/70 backdrop-blur-md"
          >
            <Info className="h-5 w-5" />
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            onClick={() => void onRefreshAll()}
            disabled={refreshing || walletLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/85 backdrop-blur-md disabled:opacity-50"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing || walletLoading ? "…" : "Обновить"}
          </motion.button>
        </div>
      </div>

      {showWalletSkeleton ? (
        <WalletBalanceBlockSkeleton />
      ) : (
        <GlassCard className="relative overflow-hidden border-white/[0.12] p-0">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600/25 via-indigo-600/15 to-purple-600/25" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="relative p-6">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-white/55">
              <Wallet className="h-4 w-4 text-white/70" />
              Доступно к выводу
            </div>
            <p className="mt-4 bg-gradient-to-r from-sky-200 via-white to-violet-200 bg-clip-text text-4xl font-semibold tabular-nums tracking-tight text-transparent sm:text-[2.65rem]">
              {userId == null ? "—" : <AnimatedMoneyRub value={availableBalance} />}
            </p>
            <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-white/45">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-white/40" aria-hidden />
              <span>{holdingPeriodUserMessage()}</span>
            </div>
            <p className="mt-3 text-[13px] tabular-nums text-white/55">
              <span className="text-white/40">Всего на счету</span>{" "}
              <span className="font-medium text-white/75">
                {userId == null ? "—" : <AnimatedMoneyRub value={totalBalance} />}
              </span>
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/40">
              Минимум для вывода — {MIN_WITHDRAW_RUB.toLocaleString("ru-RU")} ₽ с доступного баланса.
            </p>
            {userId != null && pendingWithdrawals > 0 && (
              <p className="mt-2 text-[13px] text-amber-200/90">
                На выводе: {formatMoneyRub(pendingWithdrawals)}
              </p>
            )}
            {walletError && (
              <p className="mt-2 text-xs text-rose-300">
                {walletError instanceof Error ? walletError.message : "Не удалось загрузить баланс"}
              </p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3 text-center text-xs text-white/55">
              <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2.5 backdrop-blur-md">
                <p>На модерации</p>
                <p className="mt-1 text-base font-semibold text-white/90">{summary.pending}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2.5 backdrop-blur-md">
                <p>Отклонено</p>
                <p className="mt-1 text-base font-semibold text-white/90">{summary.failed}</p>
              </div>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              transition={SPRING_UI}
              disabled={!canRequestPayout || userId == null}
              onClick={onWithdrawClick}
              className="mt-6 flex w-full items-center justify-center rounded-xl py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: "var(--tg-theme-button-color, #ffffff)",
                color: "var(--tg-theme-button-text-color, #0a0a0a)"
              }}
            >
              <MagneticWrapper strength={0.15} disabled={!canRequestPayout || userId == null}>
                Вывести средства
              </MagneticWrapper>
            </motion.button>
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-5">
        <p className="mb-3 text-sm font-medium tracking-tight text-white/90">Релизы и статусы</p>
        {userId == null && (
          <p className="text-xs text-white/55">Открой приложение из Telegram для загрузки данных.</p>
        )}
        {releasesLoading && <p className="text-xs text-white/55">Загрузка...</p>}
        {releasesError && <p className="text-xs text-rose-200">{releasesError}</p>}
        {!releasesLoading && !releasesError && userId != null && data.recentRows.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-[20px] border border-white/[0.08] bg-white/[0.03] px-5 py-8 text-center backdrop-blur-xl">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div
                className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-400/40 to-violet-500/45 blur-xl"
                aria-hidden
              />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-black/35">
                <Sparkles className="h-6 w-6 text-amber-200/95" strokeWidth={1.4} aria-hidden />
              </div>
            </div>
            <div>
              <p className="text-[14px] font-medium text-white/90">Релизов пока нет</p>
              <p className="mt-1 text-[12px] text-white/45">
                Когда загрузишь треки, здесь появятся статусы модерации.
              </p>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {data.recentRows.map((item, index) => {
            const statusMeta = getReleaseStatusMeta(item.status);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 26 }}
                className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 backdrop-blur-xl"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-white/95">{item.track_name}</p>
                  <p className="text-[11px] text-white/45">
                    {new Date(item.created_at).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-1 text-[10px] ${statusMeta.badgeClassName} ${statusMeta.badgeGlowClassName ?? ""} ${statusMeta.badgeShimmerClassName ?? ""}`}
                >
                  {statusMeta.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </GlassCard>

      <div>
        <p className="mb-3 px-0.5 text-sm font-medium text-white/80">История транзакций</p>
        {userId == null && (
          <p className="px-0.5 text-xs text-white/55">Войдите через Telegram, чтобы видеть операции.</p>
        )}
        {userId != null && walletError && !walletLoading && (
          <p className="mb-2 px-0.5 text-xs text-rose-300">
            {walletError instanceof Error ? walletError.message : "Не удалось загрузить операции"}
          </p>
        )}
        {showWalletSkeleton ? (
          <WalletTxListSkeleton />
        ) : userId != null && recentTx.length === 0 ? (
          <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] px-5 py-10 text-center shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
            <div className="relative mx-auto flex h-[76px] w-[76px] items-center justify-center">
              <div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500/35 via-sky-500/30 to-indigo-500/40 blur-2xl"
                aria-hidden
              />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-black/40">
                <Coins className="h-7 w-7 text-emerald-200/95" strokeWidth={1.35} aria-hidden />
              </div>
            </div>
            <p className="mt-5 text-[15px] font-semibold tracking-tight text-white/90">
              История пуста
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-white/45">
              Тут пока пусто: роялти появятся после первых стримов. После одобрения релизов начисления
              попадут сюда.
            </p>
          </div>
        ) : (
          <motion.div
            variants={listContainer}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-2.5"
          >
            {recentTx.map((tx) => {
              const signed = txSignedAmount(tx);
              const { Icon, iconBg } = txIcon(tx.type);
              const statusClass =
                tx.status === "completed"
                  ? "text-emerald-400/80"
                  : tx.status === "pending"
                    ? "text-amber-300/90"
                    : "text-rose-300/90";

              return (
                <motion.div
                  key={tx.id}
                  variants={listItem}
                  layout
                  className="rounded-[24px] border border-white/10 bg-white/[0.02] shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-3xl"
                >
                  <div className="flex items-center gap-3 p-3.5">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconBg}`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium leading-snug text-white/95">
                        {tx.description ?? "Операция"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/45">{formatTxDate(tx.created_at)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          signed >= 0 ? "text-emerald-300/95" : "text-rose-200/95"
                        }`}
                      >
                        {signed >= 0 ? "+" : "−"}
                        {formatMoneyRub(Math.abs(signed))}
                      </p>
                      <p className={`mt-1 text-[10px] font-medium uppercase tracking-wider ${statusClass}`}>
                        {statusLabel(tx.status)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
