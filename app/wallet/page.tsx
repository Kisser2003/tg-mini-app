"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Wallet } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/lib/supabase";
import { getTelegramUserId, initTelegramWebApp } from "@/lib/telegram";

type ReleasePayoutRow = {
  id: string;
  track_name: string;
  status: string;
  created_at: string;
};

export default function WalletPage() {
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ReleasePayoutRow[]>([]);

  useEffect(() => {
    initTelegramWebApp();
    setUserId(getTelegramUserId());
  }, []);

  useEffect(() => {
    if (userId == null) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: dbError } = await supabase
          .from("releases")
          .select("id, track_name, status, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(8);
        if (dbError) throw dbError;
        if (!cancelled) setRows((data ?? []) as ReleasePayoutRow[]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Не удалось загрузить данные кошелька.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const summary = useMemo(() => {
    const available = rows.filter((item) => item.status === "ready").length;
    const pending = rows.filter(
      (item) => item.status === "processing" || item.status === "under_review"
    ).length;
    const failed = rows.filter((item) => item.status === "failed").length;
    return { available, pending, failed };
  }, [rows]);

  return (
    <div className="flex flex-col gap-4 pb-10">
      <GlassCard className="p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-white/55">Кошелек</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Баланс и выплаты</h1>
      </GlassCard>

      <GlassCard className="p-6 text-center">
        <span className="inline-flex items-center gap-2 text-sm text-white/70">
          <Wallet className="h-4 w-4" />
          Доступно к выплате
        </span>
        <p className="mt-3 bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300 bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
          {summary.available}
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
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 to-emerald-300 px-4 py-3 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(56,189,248,0.35)]"
        >
          <ArrowUpRight className="h-4 w-4" />
          Запросить выплату
        </motion.button>
      </GlassCard>

      <GlassCard className="p-5">
        <p className="mb-3 text-sm font-medium tracking-tight text-white/85">Последние релизы</p>
        {userId == null && <p className="text-xs text-white/55">Открой приложение из Telegram для загрузки данных.</p>}
        {loading && <p className="text-xs text-white/55">Загрузка...</p>}
        {error && <p className="text-xs text-rose-200">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p className="text-xs text-white/55">Пока нет релизов для расчёта выплат.</p>
        )}
        <div className="space-y-2">
          {rows.map((item, index) => (
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
