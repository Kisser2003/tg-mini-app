"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, History, RefreshCcw } from "lucide-react";
import useSWR from "swr";
import { AdminReleaseCard } from "@/components/AdminReleaseCard";
import { PullRefreshBrand } from "@/components/PullRefreshBrand";
import { AdminModerationQueueSkeleton } from "@/components/ui/LibrarySkeleton";
import { fetchAdminModerationHistory } from "@/features/admin/moderation-history";
import { isAdminUi, isAdminUiByWebSession } from "@/lib/admin";
import { debugInit } from "@/lib/debug";
import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases.repo";
import { getTelegramUserId, initTelegramWebApp } from "@/lib/telegram";
import { errorToUserString, USER_REQUEST_TIMEOUT_MESSAGE } from "@/lib/errors";
import { SWR_LIST_OPTIONS } from "@/lib/swr-config";
import { withRequestTimeout } from "@/lib/withRequestTimeout";

type HistoryRow = {
  release: ReleaseRecord;
  tracks: ReleaseTrackRow[];
};

const HISTORY_LIMIT = 300;
const ADMIN_HISTORY_TIMEOUT_MS = 20000;
const INITIAL_VISIBLE_ROWS = 40;
const VISIBLE_ROWS_CHUNK = 40;
const NEAR_BOTTOM_OFFSET_PX = 900;

export default function AdminModerationHistoryPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminResolved, setAdminResolved] = useState(false);
  const [visibleRowsCount, setVisibleRowsCount] = useState(INITIAL_VISIBLE_ROWS);

  useEffect(() => {
    debugInit("admin/history", "init start");
    initTelegramWebApp();
    setUserId(getTelegramUserId());
    setIsAdmin(isAdminUi());
    void (async () => {
      const webAdmin = await isAdminUiByWebSession();
      setIsAdmin((prev) => prev || webAdmin);
      setAdminResolved(true);
    })();
    debugInit("admin/history", "init done");
  }, []);

  useEffect(() => {
    if (adminResolved && !isAdmin) {
      router.replace("/");
    }
  }, [adminResolved, isAdmin, router]);

  const swrKey = isAdmin ? (["admin-moderation-history", HISTORY_LIMIT] as const) : null;

  const loadHistory = useCallback(async (): Promise<{ rows: HistoryRow[]; truncated: boolean }> => {
    return fetchAdminModerationHistory(HISTORY_LIMIT);
  }, []);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    () =>
      withRequestTimeout(loadHistory(), ADMIN_HISTORY_TIMEOUT_MS, USER_REQUEST_TIMEOUT_MESSAGE),
    {
      ...SWR_LIST_OPTIONS,
      keepPreviousData: true
    }
  );

  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const visibleRows = useMemo(
    () => rows.slice(0, Math.min(visibleRowsCount, rows.length)),
    [rows, visibleRowsCount]
  );
  const hasMoreRows = visibleRows.length < rows.length;
  const listTruncated = data?.truncated === true;
  const errorMessage = errorToUserString(error);
  const showSkeleton = isLoading && data === undefined;

  useEffect(() => {
    setVisibleRowsCount(INITIAL_VISIBLE_ROWS);
  }, [rows.length]);

  useEffect(() => {
    if (!hasMoreRows) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        const nearBottom =
          window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - NEAR_BOTTOM_OFFSET_PX;
        if (nearBottom) {
          setVisibleRowsCount((prev) => Math.min(prev + VISIBLE_ROWS_CHUNK, rows.length));
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [hasMoreRows, rows.length]);

  if (adminResolved && !isAdmin) {
    return null;
  }

  if (userId == null && !isAdmin && process.env.NODE_ENV === "production") {
    return (
      <div className="glass-glow glass-glow-charged mx-5 mt-14 p-6">
        <h1 className="font-display text-xl font-bold text-white/85">История модерации</h1>
        <p className="mt-2 text-sm text-white/50">Открой приложение из Telegram для доступа к админке.</p>
      </div>
    );
  }

  return (
    <div className="min-h-app px-5 pb-44 pt-14">
      <PullRefreshBrand />

      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white/75 backdrop-blur-md hover:bg-white/[0.07]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          К очереди
        </Link>
        <button
          type="button"
          onClick={() => void mutate(undefined, { revalidate: true })}
          disabled={isValidating}
          aria-label="Обновить"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/70 backdrop-blur-md disabled:opacity-50"
        >
          <RefreshCcw className={`h-[18px] w-[18px] ${isValidating ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/25 bg-violet-500/10 text-violet-200">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white/80">История решений</h1>
          <p className="text-sm text-white/45">Одобренные и отклонённые релизы</p>
        </div>
      </div>

      {listTruncated && rows.length > 0 && (
        <div className="glass-glow glass-glow-charged mb-4 p-3 text-xs text-amber-100/85">
          Показаны последние {HISTORY_LIMIT} релизов по дате создания. Если нужно больше — напишите в поддержку,
          добавим пагинацию.
        </div>
      )}

      {errorMessage && (
        <div className="glass-glow glass-glow-charged mb-4 p-4 text-sm text-rose-200">{errorMessage}</div>
      )}

      {showSkeleton && <AdminModerationQueueSkeleton rows={4} />}

      {!showSkeleton && !errorMessage && rows.length === 0 && (
        <div className="glass-glow glass-glow-charged p-5 text-sm text-white/50">
          Пока нет релизов со статусом «Готов» или «Отклонено».
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-col gap-3">
          {visibleRows.map((row, index) => (
            <AdminReleaseCard
              key={row.release.id}
              release={row.release}
              tracks={row.tracks}
              index={index}
              listVariants={undefined}
              busy={false}
              onOpenApprove={() => {}}
              onOpenReject={() => {}}
              showModerationActions={false}
              showAudioPreview={false}
              detailHref={`/admin/release/${row.release.id}`}
              artworkPriority={index < 4}
            />
          ))}
        </div>
      )}

      {hasMoreRows && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleRowsCount((prev) => Math.min(prev + VISIBLE_ROWS_CHUNK, rows.length))}
            className="inline-flex items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.08]"
          >
            Показать еще ({visibleRows.length}/{rows.length})
          </button>
        </div>
      )}
    </div>
  );
}
