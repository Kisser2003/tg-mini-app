"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { initUserContextInStore } from "@/features/release/createRelease/actions";
import { getMyReleases, type ReleaseRecord } from "@/repositories/releases.repo";
import {
  getTelegramWebApp,
  getTelegramUserIdForSupabaseRequests,
  initTelegramWebApp,
  type TelegramUser
} from "@/lib/telegram";
import { USER_REQUEST_TIMEOUT_MESSAGE } from "@/lib/errors";
import { SWR_LIST_OPTIONS } from "@/lib/swr-config";
import { withRequestTimeout } from "@/lib/withRequestTimeout";
import { normalizeReleaseStatus } from "@/lib/release-status";

export type ReleaseListRow = Pick<
  ReleaseRecord,
  | "id"
  | "title"
  | "track_name"
  | "artwork_url"
  | "status"
  | "created_at"
  | "error_message"
  | "admin_notes"
  | "draft_upload_started"
  | "isrc"
>;

const RELEASES_LIST_TIMEOUT_MS = 15000;

async function fetchReleasesForUser([, uid]: readonly ["releases", string]): Promise<ReleaseListRow[]> {
  const rows = await withRequestTimeout(
    getMyReleases(uid),
    RELEASES_LIST_TIMEOUT_MS,
    USER_REQUEST_TIMEOUT_MESSAGE
  );
  return rows as ReleaseListRow[];
}

/**
 * Library list: same SWR key `["releases", telegramUserId]` and refresh rules as the dashboard.
 */
export function useReleases() {
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);

  useEffect(() => {
    initTelegramWebApp();
    initUserContextInStore();
    setUser(getTelegramWebApp()?.initDataUnsafe?.user ?? null);
    const tid = getTelegramUserIdForSupabaseRequests();
    setUserId(tid != null ? String(tid) : null);
  }, []);

  const swrKey = userId != null ? (["releases", userId] as const) : null;

  const swr = useSWR(swrKey, fetchReleasesForUser, {
    ...SWR_LIST_OPTIONS,
    revalidateOnFocus: true,
    refreshInterval: (latestData: ReleaseListRow[] | undefined) =>
      latestData?.some((r) => normalizeReleaseStatus(r.status) === "processing") ? 7000 : 0,
    keepPreviousData: false
  });

  const releases = useMemo(() => swr.data ?? [], [swr.data]);

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

  return {
    userId,
    telegramUser: user,
    releases,
    releaseStats,
    ...swr
  };
}
