"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, RefreshCcw, Wallet } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { debugInit } from "@/lib/debug";
import { getReleaseStatusMeta, normalizeReleaseStatus } from "@/lib/release-status";
import { supabase } from "@/lib/supabase";
import { getTelegramUserId, initTelegramWebApp } from "@/lib/telegram";
import { useSafePolling } from "@/lib/useSafePolling";

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

const MIN_WITHDRAW_RUB = 1000;
const ESTIMATED_RUB_PER_READY_RELEASE = 500;

export default function WalletPage() {
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    debugInit("wallet", "init start");
    initTelegramWebApp();
    setUserId(getTelegramUserId());
    debugInit("wallet", "init done");
  }, []);

  const loadRows = useCallback(
    async () => {
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
    },
    [userId]
  );

  const {
    data,
    loading,
    refreshing,
    error,
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
    const counters = data.summaryRows.reduce(
      (acc, row) => {
        const normalized = normalizeReleaseStatus(row.status);
        if (normalized === "ready") acc.available += 1;
        else if (normalized === "processing") acc.pending += 1;
        else if (normalized === "failed") acc.failed += 1;
        return acc;
      },
      { available: 0, pending: 0, failed: 0 }
    );
    const { available, pending, failed } = counters;
    return { available, pending, failed };
  }, [data.summaryRows]);
  const estimatedBalanceRub = summary.available * ESTIMATED_RUB_PER_READY_RELEASE;
  const canRequestPayout = estimatedBalanceRub >= MIN_WITHDRAW_RUB;

  return (
    <div className="flex flex-col gap-4 pb-10">
      <GlassCard className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/55">Кошелек</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Баланс и выплаты</h1>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 0.99 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            onClick={() => void loadWithSafety(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 disabled:opacity-60"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Обновляем..." : "Обновить"}
          </motion.button>
        </div>
      </GlassCard>

      <GlassCard className="p-6 text-center">
        <span className="inline-flex items-center gap-2 text-sm text-white/70">
          <Wallet className="h-4 w-4" />
          Доступно к выплате
        </span>
        <p className="mt-3 bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300 bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
          {estimatedBalanceRub.toLocaleString("ru-RU")} ₽
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-white/60">
          <motion.div
            whileHover={{ scale: 0.995 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur-3xl"
          >
            <p>На модерации</p>
            <p className="mt-1 text-sm text-white/90">{summary.pending}</p>
          </motion.div>
          <motion.div
            whileHover={{ scale: 0.995 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur-3xl"
          >
            <p>Отклонено</p>
            <p className="mt-1 text-sm text-white/90">{summary.failed}</p>
          </motion.div>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 0.99 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          disabled={!canRequestPayout}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 to-emerald-300 px-4 py-3 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(56,189,248,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowUpRight className="h-4 w-4" />
          Запросить выплату
        </motion.button>
        <p className="mt-2 text-xs text-white/55">
          Минимум {MIN_WITHDRAW_RUB.toLocaleString("ru-RU")} ₽ для вывода.
        </p>
      </GlassCard>

      <GlassCard className="p-5">
        <p className="mb-3 text-sm font-medium tracking-tight text-white/85">Последние релизы</p>
        {userId == null && <p className="text-xs text-white/55">Открой приложение из Telegram для загрузки данных.</p>}
        {loading && <p className="text-xs text-white/55">Загрузка...</p>}
        {error && <p className="text-xs text-rose-200">{error}</p>}
        {!loading && !error && data.recentRows.length === 0 && (
          <p className="text-xs text-white/55">Пока нет релизов для расчёта выплат.</p>
        )}
        <div className="space-y-2">
          {data.recentRows.map((item, index) => {
            const statusMeta = getReleaseStatusMeta(item.status);
            return (
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
                <p className="text-sm">{item.track_name}</p>
                <p className="text-xs text-white/55">{new Date(item.created_at).toLocaleDateString("ru-RU")}</p>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[10px] ${statusMeta.badgeClassName}`}>
                {statusMeta.label}
              </span>
            </motion.div>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <p className="mb-3 text-sm font-medium tracking-tight text-white/85">История транзакций</p>
        <p className="text-xs text-white/55">
          Операций пока нет. Здесь появятся выплаты со статусами «в обработке» и «выплачено».
        </p>
      </GlassCard>
    </div>
  );
}
