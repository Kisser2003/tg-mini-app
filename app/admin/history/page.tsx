"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCcw } from "lucide-react";
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
      <div className="mx-auto max-w-lg px-1 pt-10">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">История решений</h1>
        <p className="mt-2 text-[15px] text-omf-graphite">Открой приложение из Telegram, чтобы попасть в админку.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-app max-w-lg px-1 pb-40 pt-4 text-omf-ink">
      <PullRefreshBrand />

      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/admin"
          className="omf-focus -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[14px] text-omf-graphite transition-colors hover:text-omf-ink"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Очередь
        </Link>
        <button
          type="button"
          onClick={() => void mutate(undefined, { revalidate: true })}
          disabled={isValidating}
          aria-label="Обновить историю"
          className="omf-focus flex h-10 w-10 items-center justify-center rounded-full text-omf-graphite transition-colors hover:bg-omf-surface hover:text-omf-ink disabled:opacity-50"
        >
          <RefreshCcw className={`h-[18px] w-[18px] ${isValidating ? "animate-spin" : ""}`} aria-hidden />
        </button>
      </div>

      <header className="mb-6">
        <p className="text-[13px] text-omf-graphite">Одобренные и возвращённые релизы</p>
        <h1 className="mt-1 text-[40px] font-extrabold leading-[0.92] tracking-[-0.045em]">История</h1>
      </header>

      {listTruncated && rows.length > 0 && (
        <p className="mb-4 text-[14px] text-omf-yellow">
          Показаны последние {HISTORY_LIMIT} релизов. Более старых здесь пока нет.
        </p>
      )}

      {errorMessage && <p className="mb-4 text-[14px] text-omf-red">{errorMessage}</p>}

      {showSkeleton && <AdminModerationQueueSkeleton rows={4} />}

      {!showSkeleton && !errorMessage && rows.length === 0 && (
        <div className="border-t border-omf-line pt-6">
          <p className="text-[18px] font-bold tracking-tight">История пока пуста</p>
          <p className="mt-1.5 text-[14px] text-omf-graphite">
            Здесь появятся релизы, по которым вы приняли решение.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-col">
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
        <button
          type="button"
          onClick={() => setVisibleRowsCount((prev) => Math.min(prev + VISIBLE_ROWS_CHUNK, rows.length))}
          className="omf-btn-secondary mt-5 w-full"
        >
          Показать ещё ({visibleRows.length} из {rows.length})
        </button>
      )}
    </div>
  );
}
