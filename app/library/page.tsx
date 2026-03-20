"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent
} from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { GlassCard } from "@/components/GlassCard";
import { ReleaseCardSkeletonList } from "@/components/ReleaseCardSkeleton";
import { debugInit } from "@/lib/debug";
import { resumeDraftFromRelease } from "@/features/release/createRelease/actions";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import { getReleaseStatusMeta, normalizeReleaseStatus } from "@/lib/release-status";
import { supabase } from "@/lib/supabase";
import { getTelegramUserId, initTelegramWebApp, triggerHaptic } from "@/lib/telegram";
import { withRequestTimeout } from "@/lib/withRequestTimeout";
import { toast } from "sonner";
import type { ReleaseStatus } from "@/lib/db-enums";

type ReleaseRow = {
  id: string;
  track_name: string;
  artwork_url: string | null;
  status: ReleaseStatus;
  created_at: string;
  error_message?: string | null;
};

const ARTWORK_SIZES = "(max-width: 768px) 100vw, 33vw";
const RELEASES_LIST_TIMEOUT_MS = 12000;

function ArtworkThumb({
  url,
  title,
  priority = false
}: {
  url: string | null;
  title: string;
  priority?: boolean;
}) {
  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
      {url ? (
        <Image
          src={url}
          alt={title}
          fill
          sizes={ARTWORK_SIZES}
          className="object-cover"
          priority={priority}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-white/50">
          NO ART
        </div>
      )}
    </div>
  );
}

async function fetchReleasesForUser([, uid]: readonly ["releases", number]): Promise<ReleaseRow[]> {
  debugInit("library", "loadReleases start", { userId: uid });
  const queryPromise = (async () => {
    const { data, error: dbError } = await supabase
      .from("releases")
      .select("id, track_name, artwork_url, status, error_message, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (dbError) throw dbError;
    return (data ?? []) as ReleaseRow[];
  })();

  const rows = await withRequestTimeout(
    queryPromise,
    RELEASES_LIST_TIMEOUT_MS,
    `Запрос превысил таймаут (${RELEASES_LIST_TIMEOUT_MS} мс).`
  );
  debugInit("library", "loadReleases success", { count: rows.length });
  return rows;
}

function LibraryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<number | null>(null);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);

  useEffect(() => {
    debugInit("library", "init start");
    initTelegramWebApp();
    setUserId(getTelegramUserId());
    debugInit("library", "init done");
  }, []);

  const swrKey = userId != null ? (["releases", userId] as const) : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    fetchReleasesForUser,
    {
      refreshInterval: 7000,
      keepPreviousData: true
    }
  );

  const releases = useMemo(() => data ?? [], [data]);
  const errorMessage =
    error instanceof Error ? error.message : error != null ? String(error) : null;

  useEffect(() => {
    if (searchParams.get("fromCreate") !== "1") return;
    void mutate(undefined, { revalidate: true });
    router.replace("/library");
  }, [searchParams, mutate, router]);

  const handleCreate = () => {
    triggerHaptic("light");
    router.push("/create/metadata");
  };

  const handleResumeDraft = useCallback(
    async (release: ReleaseRow) => {
      triggerHaptic("light");
      setResumingId(release.id);
      try {
        const path = await resumeDraftFromRelease(release.id);
        if (!path) {
          const msg =
            useCreateReleaseDraftStore.getState().submitError ?? "Не удалось открыть черновик.";
          toast.error(msg);
          return;
        }
        router.push(path);
      } finally {
        setResumingId(null);
      }
    },
    [router]
  );

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

  const showTelegramWait = userId === null;
  const showListSkeleton = userId != null && isLoading && data === undefined;

  return (
    <div className="min-h-screen bg-background px-5 py-6 pb-10 text-text">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-6 font-sans">
        <GlassCard className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <h1 className="text-[20px] font-semibold tracking-tight">Мои релизы</h1>
            <div className="flex flex-wrap items-center gap-2">
              <motion.button
                type="button"
                whileHover={{ scale: 0.99 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                onClick={() => void mutate(undefined, { revalidate: true })}
                disabled={isValidating}
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 disabled:opacity-60"
              >
                {isValidating ? "Обновляем..." : "Обновить"}
              </motion.button>
              <button
                type="button"
                onClick={handleCreate}
                className="rounded-[16px] bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground shadow-md"
              >
                Новый релиз
              </button>
            </div>
          </div>
        </GlassCard>

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

        <div className="mt-2 flex flex-col gap-4">
          {(showTelegramWait || showListSkeleton) && (
            <div className="space-y-4">
              <p className="text-[13px] text-text-muted">
                {showTelegramWait ? "Подключаем Telegram…" : "Загружаем твои релизы из OMF…"}
              </p>
              <ReleaseCardSkeletonList count={3} />
            </div>
          )}

          {errorMessage && (
            <div className="rounded-[20px] border border-red-500/30 bg-red-950/40 px-4 py-3 text-[13px] text-red-100">
              {errorMessage}
            </div>
          )}

          {userId != null && !showListSkeleton && !errorMessage && !hasReleases && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-[24px] border border-white/[0.08] bg-surface/80 px-6 py-10 text-center shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
              <div className="text-4xl">🎧</div>
              <div className="space-y-1">
                <p className="text-[16px] font-semibold">У тебя пока нет релизов</p>
                <p className="text-[13px] text-text-muted">Загрузи свой первый трек.</p>
              </div>
              <button
                type="button"
                onClick={handleCreate}
                className="mt-2 inline-flex h-[52px] w-full max-w-[320px] items-center justify-center rounded-[18px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[15px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.6)]"
              >
                Загрузить первый релиз
              </button>
            </div>
          )}

          {userId != null && hasReleases && (
            <div className="space-y-3">
              <AnimatePresence>
                {releases.map((release, listIndex) => {
                  const statusMeta = getReleaseStatusMeta(release.status);
                  const normalizedStatus = normalizeReleaseStatus(release.status);
                  const isDraft = normalizedStatus === "draft";
                  const isFailed = normalizedStatus === "failed";
                  const isResumingDraft = isDraft && resumingId === release.id;
                  const hasErrorText =
                    (release.error_message && release.error_message.trim().length > 0) || false;
                  const effectiveErrorText = hasErrorText
                    ? release.error_message!
                    : "Причина ошибки не указана";
                  const isExpanded = expandedErrorId === release.id;
                  const thumbPriority = listIndex < 3 && Boolean(release.artwork_url);

                  if (isDraft) {
                    return (
                      <motion.div
                        key={release.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className={`flex w-full gap-3 rounded-[20px] border border-white/[0.08] bg-surface/80 px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl ${
                          isResumingDraft ? "pointer-events-none opacity-70" : "cursor-pointer select-none"
                        }`}
                        role="button"
                        tabIndex={0}
                        aria-busy={isResumingDraft}
                        aria-label={`Продолжить заполнение черновика: ${release.track_name}`}
                        whileHover={isResumingDraft ? undefined : { scale: 1.01, opacity: 0.96 }}
                        whileTap={isResumingDraft ? undefined : { scale: 0.985 }}
                        onClick={() => {
                          void handleResumeDraft(release);
                        }}
                        onKeyDown={(e: KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void handleResumeDraft(release);
                          }
                        }}
                      >
                        <ArtworkThumb
                          url={release.artwork_url}
                          title={release.track_name}
                          priority={thumbPriority}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold">{release.track_name}</p>
                          <p className="mt-0.5 text-[11px] text-text-muted">
                            {new Date(release.created_at).toLocaleString("ru-RU", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center self-start rounded-full border px-3 py-1 text-[11px] font-medium ${statusMeta.badgeClassName}`}
                        >
                          {statusMeta.label}
                        </span>
                      </motion.div>
                    );
                  }

                  if (isFailed) {
                    return (
                      <motion.div
                        key={release.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="rounded-[20px] border border-white/[0.08] bg-surface/80 px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
                      >
                        <div className="flex gap-3">
                          <ArtworkThumb
                            url={release.artwork_url}
                            title={release.track_name}
                            priority={thumbPriority}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold">{release.track_name}</p>
                            <p className="mt-0.5 text-[11px] text-text-muted">
                              {new Date(release.created_at).toLocaleString("ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <button
                              type="button"
                              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium ${statusMeta.badgeClassName}`}
                              onClick={() => {
                                setExpandedErrorId((prev) =>
                                  prev === release.id ? null : release.id
                                );
                              }}
                            >
                              {statusMeta.label}
                              <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[9px]">
                                i
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                router.push(
                                  `/create/metadata?from=failed&releaseId=${release.id}`
                                );
                              }}
                              className="text-[11px] font-medium text-red-300 underline underline-offset-2"
                            >
                              Исправить
                            </button>
                          </div>
                        </div>
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
                      </motion.div>
                    );
                  }

                  return (
                    <motion.button
                      key={release.id}
                      type="button"
                      onClick={() => router.push(`/release/${release.id}`)}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 0.995 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 280, damping: 24 }}
                      className="glass-card flex w-full items-center gap-3 p-4 text-left"
                    >
                      <ArtworkThumb
                        url={release.artwork_url}
                        title={release.track_name}
                        priority={thumbPriority}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{release.track_name}</p>
                        <p className="text-xs text-white/60">
                          {new Date(release.created_at).toLocaleDateString("ru-RU")}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-[10px] ${statusMeta.badgeClassName}`}
                      >
                        {statusMeta.label}
                      </span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background px-5 py-6 text-text">
          <div className="flex flex-col items-center gap-4">
            <div
              className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-[#7C3AED]"
              aria-hidden="true"
            />
            <p className="text-[13px] text-text-muted">Загрузка…</p>
          </div>
        </div>
      }
    >
      <LibraryPageInner />
    </Suspense>
  );
}
