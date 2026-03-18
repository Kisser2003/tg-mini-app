"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { getExpectedAdminTelegramId } from "@/lib/admin";
import { supabase } from "@/lib/supabase";
import { getTelegramUserDisplayName, getTelegramUserId, initTelegramWebApp } from "@/lib/telegram";
import type { ReleaseStatus } from "@/lib/db-enums";

type ReleaseRow = {
  id: string;
  track_name: string;
  status: ReleaseStatus;
  created_at: string;
  error_message?: string | null;
};

const getStatusMeta = (status: string) => {
  switch (status) {
    case "ready":
      return { text: "Готов", color: "green" as const };
    case "processing":
      return { text: "На модерации", color: "yellow" as const };
    case "under_review":
      return { text: "На проверке менеджером", color: "blue" as const };
    case "failed":
      return { text: "Ошибка", color: "red" as const };
    default:
      return { text: "Черновик", color: "gray" as const };
  }
};

export default function DashboardPage() {
  const router = useRouter();
  const [telegramName, setTelegramName] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [releases, setReleases] = useState<ReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  useEffect(() => {
    initTelegramWebApp();
    const id = getTelegramUserId();
    setUserId(id ?? null);
    setTelegramName(getTelegramUserDisplayName());
  }, []);

  useEffect(() => {
    if (userId == null) {
      setLoading(false);
      setReleases([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error: dbError } = await supabase
          .from("releases")
          .select("id, track_name, status, created_at, error_message")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (dbError) {
          throw dbError;
        }

        setReleases((data ?? []) as ReleaseRow[]);
      } catch (e: any) {
        setError(e?.message ?? "Не удалось загрузить релизы.");
      } finally {
        setLoading(false);
      }
    };

    void load();
    const intervalId = window.setInterval(load, 7000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [userId]);

  const handleCreate = () => {
    router.push("/create/metadata");
  };

  const hasReleases = useMemo(() => releases.length > 0, [releases]);
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

        {loading && (
          <div className="space-y-4">
            <p className="text-[13px] text-text-muted">
              Загружаем твои релизы из OMF…
            </p>
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  className="h-[64px] rounded-[20px] bg-surface/80"
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-[20px] border border-red-500/30 bg-red-950/40 px-4 py-3 text-[13px] text-red-100">
            {error}
          </div>
        )}

        {!loading && !error && !hasReleases && (
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

        {!loading && hasReleases && (
          <div className="space-y-3">
            <AnimatePresence>
              {releases.map((release) => {
                const meta = getStatusMeta(release.status);
                const colorClass =
                  meta.color === "green"
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                    : meta.color === "yellow"
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                    : meta.color === "red"
                    ? "bg-red-500/15 text-red-300 border-red-500/40"
                    : meta.color === "blue"
                    ? "bg-sky-500/15 text-sky-300 border-sky-500/40"
                    : "bg-zinc-500/10 text-zinc-300 border-zinc-500/30";

                const isFailed = release.status === "failed";
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
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium ${colorClass}`}
                          onClick={() => {
                            if (!isFailed) return;
                            setExpandedErrorId((prev) =>
                              prev === release.id ? null : release.id
                            );
                          }}
                        >
                          {meta.text}
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

