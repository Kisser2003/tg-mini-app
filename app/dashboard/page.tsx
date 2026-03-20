"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { getExpectedAdminTelegramId } from "@/lib/admin";
import { debugInit } from "@/lib/debug";
import { getReleaseStatusMeta, normalizeReleaseStatus } from "@/lib/release-status";
import { supabase } from "@/lib/supabase";
import {
  getTelegramUserDisplayName,
  getTelegramUserId,
  initTelegramWebApp,
  triggerHaptic
} from "@/lib/telegram";
import { ReleaseCardSkeletonList } from "@/components/ReleaseCardSkeleton";
import { useSafePolling } from "@/lib/useSafePolling";
import type { ReleaseStatus } from "@/lib/db-enums";

type ReleaseRow = {
  id: string;
  track_name: string;
  status: ReleaseStatus;
  created_at: string;
  error_message?: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [telegramName, setTelegramName] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  useEffect(() => {
    debugInit("dashboard", "init start");
    initTelegramWebApp();
    const id = getTelegramUserId();
    setUserId(id ?? null);
    setTelegramName(getTelegramUserDisplayName());
    debugInit("dashboard", "init done", { userId: id ?? null });
  }, []);

  const loadReleases = useCallback(async () => {
    if (userId == null) return [] as ReleaseRow[];
    debugInit("dashboard", "loadReleases start", { userId });
    const { data, error: dbError } = await supabase
      .from("releases")
      .select("id, track_name, status, created_at, error_message")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (dbError) throw dbError;
    debugInit("dashboard", "loadReleases success", { count: (data ?? []).length });
    return (data ?? []) as ReleaseRow[];
  }, [userId]);

  const {
    data: releases,
    loading,
    error
  } = useSafePolling<ReleaseRow[]>({
    enabled: userId != null,
    intervalMs: 7000,
    load: loadReleases,
    initialData: [],
    requestTimeoutMs: 12000,
    debugName: "dashboard.releases"
  });

  const handleCreate = () => {
    triggerHaptic("light");
    router.push("/create/metadata");
  };

  const hasReleases = useMemo(() => releases.length > 0, [releases]);
  const releaseStats = useMemo(() => {
    return releases.reduce(
      (acc, release) => {
        const status = normalizeReleaseStatus(release.status);
        if (status === "ready") acc.ready += 1;
        else if (status === "processing") acc.processing += 1;
        else if (status === "failed") acc.failed += 1;
        return acc;
      },
      { ready: 0, processing: 0, failed: 0 }
    );
  }, [releases]);
  const isAdmin = userId === getExpectedAdminTelegramId();

  return (
    <div className="min-h-screen bg-background px-5 py-6 pb-10 text-text">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-6 font-sans">
        <header className="flex items-center justify-between gap-3">
          <span
            className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-[15px] font-semibold tracking-[0.28em] text-transparent"
            style={{ letterSpacing: "0.28em" }}
          >
            OMF 2026
          </span>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  initTelegramWebApp();
                  window.location.assign("/admin");
                }}
                className="inline-flex h-8 items-center gap-1 rounded-[999px] border border-emerald-500/40 bg-emerald-500/10 px-2.5 text-[11px] font-medium text-emerald-300"
                aria-label="Открыть админку"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Админ
              </button>
            )}
            {telegramName && (
              <p className="max-w-[180px] truncate text-[12px] text-text-muted">
                Привет, {telegramName}!
              </p>
            )}
          </div>
        </header>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight">
              Твои релизы
            </h1>
            <p className="text-[13px] text-text-muted">
              Управляй релизами и загружай новые.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-[16px] bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground shadow-md"
          >
            Новый релиз
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-[16px] border border-emerald-500/30 bg-emerald-500/10 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-200/80">Готово</p>
            <p className="mt-1 text-lg font-semibold text-emerald-100">{releaseStats.ready}</p>
          </div>
          <div className="rounded-[16px] border border-amber-500/30 bg-amber-500/10 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-amber-200/80">Проверка</p>
            <p className="mt-1 text-lg font-semibold text-amber-100">{releaseStats.processing}</p>
          </div>
          <div className="rounded-[16px] border border-rose-500/30 bg-rose-500/10 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-rose-200/80">Ошибки</p>
            <p className="mt-1 text-lg font-semibold text-rose-100">{releaseStats.failed}</p>
          </div>
        </div>

        {(userId === null || loading) && (
          <div className="space-y-4">
            <p className="text-[13px] text-text-muted">
              {userId === null
                ? "Подключаем Telegram…"
                : "Загружаем твои релизы из OMF…"}
            </p>
            <ReleaseCardSkeletonList count={3} />
          </div>
        )}

        {error && (
          <div className="rounded-[20px] border border-red-500/30 bg-red-950/40 px-4 py-3 text-[13px] text-red-100">
            {error}
          </div>
        )}

        {userId != null && !loading && !error && !hasReleases && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-[24px] border border-white/[0.08] bg-surface/80 px-6 py-10 text-center shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
            <div className="text-4xl">🎧</div>
            <div className="space-y-1">
              <p className="text-[16px] font-semibold">
                У тебя пока нет релизов
              </p>
              <p className="text-[13px] text-text-muted">
                Загрузи свой первый трек.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              className="mt-2 inline-flex h-[52px] w-full items-center justify-center rounded-[18px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[15px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.6)]"
            >
              Загрузить первый релиз
            </button>
          </div>
        )}

        {userId != null && !loading && hasReleases && (
          <div className="space-y-3">
            <AnimatePresence>
              {releases.map((release) => {
                const statusMeta = getReleaseStatusMeta(release.status);

                const normalizedStatus = normalizeReleaseStatus(release.status);
                const isFailed = normalizedStatus === "failed";
                const hasErrorText =
                  (release.error_message && release.error_message.trim().length > 0) ||
                  false;
                const effectiveErrorText = hasErrorText
                  ? release.error_message!
                  : "Причина ошибки не указана";
                const isExpanded = expandedErrorId === release.id;

                return (
                  <motion.div
                    key={release.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-[20px] border border-white/[0.08] bg-surface/80 px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold">
                          {release.track_name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-text-muted">
                          {new Date(release.created_at).toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium ${statusMeta.badgeClassName}`}
                          onClick={() => {
                            if (!isFailed) return;
                            setExpandedErrorId((prev) =>
                              prev === release.id ? null : release.id
                            );
                          }}
                        >
                          {statusMeta.label}
                          {isFailed && (
                            <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[9px]">
                              i
                            </span>
                          )}
                        </button>

                        {isFailed && (
                          <button
                            type="button"
                            onClick={() => {
                              router.push(`/create/metadata?from=failed&releaseId=${release.id}`);
                            }}
                            className="text-[11px] font-medium text-red-300 underline underline-offset-2"
                          >
                            Исправить
                          </button>
                        )}
                      </div>
                    </div>

                    {isFailed && (
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                            className="mt-3 rounded-[16px] border border-red-500/30 bg-red-950/40 px-3 py-2 text-[11px] font-mono leading-relaxed text-red-400/80 shadow-[0_14px_30px_rgba(0,0,0,0.7)] backdrop-blur-xl"
                          >
                            {effectiveErrorText}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

