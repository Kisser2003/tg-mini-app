"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { initUserContextInStore } from "@/features/release/createRelease/actions";
import { getMyReleases } from "@/repositories/releases.repo";
import { type ReleaseRecord } from "@/repositories/releases.repo";
import {
  getTelegramApiAuthHeaders,
  isTelegramClientShell,
  getTelegramWebApp,
  getTelegramUserIdForSupabaseRequests,
  initTelegramWebApp,
  type TelegramUser
} from "@/lib/telegram";
import { createSupabaseBrowser } from "@/lib/supabase";
import { USER_REQUEST_TIMEOUT_MESSAGE } from "@/lib/errors";
import { SWR_LIST_OPTIONS } from "@/lib/swr-config";
import { withRequestTimeout } from "@/lib/withRequestTimeout";
import { normalizeReleaseStatus } from "@/lib/release-status";
import type { Session } from "@supabase/supabase-js";

export type ReleaseListRow = Pick<
  ReleaseRecord,
  | "id"
  | "title"
  | "track_name"
  | "artist_name"
  | "artwork_url"
  | "status"
  | "created_at"
  | "error_message"
  | "admin_notes"
  | "draft_upload_started"
  | "isrc"
  | "upc"
  | "release_type"
  | "smart_link"
>;

const RELEASES_LIST_TIMEOUT_MS = 15000;

type ReleasesSwrKey =
  | readonly ["releases", "telegram", string]
  | readonly ["releases", "web", string];

async function fetchReleasesTelegram([, , uid]: readonly ["releases", "telegram", string]): Promise<
  ReleaseListRow[]
> {
  const numericUid = Number(uid);
  const fallbackUid =
    Number.isFinite(numericUid) && numericUid > 0
      ? Math.trunc(numericUid)
      : getTelegramUserIdForSupabaseRequests();
  const tryDirectFallback = async (): Promise<ReleaseListRow[]> => {
    if (!Number.isFinite(fallbackUid ?? NaN) || (fallbackUid ?? 0) <= 0) return [];
    const rows = await withRequestTimeout(
      getMyReleases(fallbackUid as number),
      RELEASES_LIST_TIMEOUT_MS,
      USER_REQUEST_TIMEOUT_MESSAGE
    );
    return rows as ReleaseListRow[];
  };

  const run = async () => {
    const res = await fetch("/api/releases/my", {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...getTelegramApiAuthHeaders(
          Number.isFinite(numericUid) && numericUid > 0 ? { userId: numericUid } : undefined
        )
      },
      cache: "no-store"
    });
    const json = (await res.json()) as { ok?: boolean; rows?: ReleaseListRow[]; error?: string };
    if (!res.ok || json.ok !== true || !Array.isArray(json.rows)) {
      const directRows = await tryDirectFallback();
      if (directRows.length > 0) return directRows;
      throw new Error(json.error || "Не удалось загрузить релизы.");
    }
    if (json.rows.length === 0) {
      const directRows = await tryDirectFallback();
      if (directRows.length > 0) return directRows;
    }
    return json.rows;
  };
  return withRequestTimeout(run(), RELEASES_LIST_TIMEOUT_MS, USER_REQUEST_TIMEOUT_MESSAGE);
}

async function fetchReleasesWeb([, , _authUid]: readonly ["releases", "web", string]): Promise<
  ReleaseListRow[]
> {
  const run = async () => {
    const res = await fetch("/api/releases/my", {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    const json = (await res.json()) as { ok?: boolean; rows?: ReleaseListRow[]; error?: string };
    if (!res.ok || json.ok !== true || !Array.isArray(json.rows)) {
      throw new Error(json.error || "Не удалось загрузить релизы.");
    }
    return json.rows;
  };
  return withRequestTimeout(run(), RELEASES_LIST_TIMEOUT_MS, USER_REQUEST_TIMEOUT_MESSAGE);
}

async function fetchReleases(key: ReleasesSwrKey): Promise<ReleaseListRow[]> {
  if (key[1] === "telegram") {
    return fetchReleasesTelegram(key);
  }
  return fetchReleasesWeb(key);
}

/**
 * Library list: Telegram — по telegram id + anon/заголовок; Web — по JWT и RLS.
 */
export function useReleases() {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  /** telegram | web — откуда взяли userId для SWR */
  const [authMode, setAuthMode] = useState<"telegram" | "web" | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [greetingName, setGreetingName] = useState<string>("Артист");
  const [hasResolvedInitialFetch, setHasResolvedInitialFetch] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let telegramModeLocked = false;
    initTelegramWebApp();
    initUserContextInStore();

    const applyTelegramMode = (tid: number | null) => {
      if (cancelled) return;
      telegramModeLocked = true;
      setUser((prev) => getTelegramWebApp()?.initDataUnsafe?.user ?? prev ?? null);
      setUserId(tid != null ? String(tid) : "__tg_shell__");
      setAuthMode("telegram");
      const tg = getTelegramWebApp()?.initDataUnsafe?.user;
      setGreetingName((prev) => tg?.first_name?.trim() || tg?.username?.trim() || prev || "Артист");
      setAuthReady(true);
    };

    const tidNow = getTelegramUserIdForSupabaseRequests();
    if (tidNow != null) {
      applyTelegramMode(tidNow);
      return () => {
        cancelled = true;
      };
    }
    if (isTelegramClientShell()) {
      // Не блокируем список релизов ожиданием user.id: API сам определит Telegram actor по initData/cookie.
      applyTelegramMode(null);
      return () => {
        cancelled = true;
      };
    }

    const supabase = createSupabaseBrowser();

    const applySession = (session: Session | null) => {
      if (cancelled) return;
      if (telegramModeLocked || isTelegramClientShell()) {
        const tid = getTelegramUserIdForSupabaseRequests();
        applyTelegramMode(tid ?? null);
        return;
      }
      const tid = getTelegramUserIdForSupabaseRequests();
      if (tid != null) {
        applyTelegramMode(tid);
        return;
      }
      if (session?.user) {
        setUserId(session.user.id);
        setAuthMode("web");
        const meta = session.user.user_metadata as { display_name?: string | null };
        const email = session.user.email;
        const name =
          meta?.display_name?.trim() ||
          email?.split("@")[0]?.trim() ||
          "Артист";
        setGreetingName(name);
      } else {
        if (telegramModeLocked) return;
        setUserId(null);
        setAuthMode(null);
        setGreetingName((prev) => prev || "Артист");
      }
      setAuthReady(true);
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    const poll = window.setInterval(() => {
      if (cancelled) return;
      const tid = getTelegramUserIdForSupabaseRequests();
      if (tid != null) {
        window.clearInterval(poll);
        applyTelegramMode(tid);
        return;
      }
      if (isTelegramClientShell()) {
        applyTelegramMode(null);
      }
    }, 50);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      subscription.unsubscribe();
    };
  }, []);

  const swrKey: ReleasesSwrKey | null = useMemo(() => {
    if (!authReady || userId == null || authMode == null) return null;
    if (authMode === "telegram") {
      return ["releases", "telegram", userId];
    }
    return ["releases", "web", userId];
  }, [authReady, userId, authMode]);

  const swr = useSWR(swrKey, fetchReleases, {
    ...SWR_LIST_OPTIONS,
    revalidateOnFocus: true,
    refreshInterval: (latestData: ReleaseListRow[] | undefined) =>
      latestData?.some((r) => normalizeReleaseStatus(r.status) === "processing") ? 7000 : 0,
    keepPreviousData: false
  });

  /**
   * "Первичная загрузка завершена" = получили данные или ошибку для активного ключа.
   * Пока нет этого флага, UI должен показывать skeleton, а не empty-state.
   */
  useEffect(() => {
    if (swrKey == null) {
      setHasResolvedInitialFetch(false);
      return;
    }
    if (swr.data !== undefined || swr.error != null || (!swr.isLoading && !swr.isValidating)) {
      setHasResolvedInitialFetch(true);
    }
  }, [swrKey, swr.data, swr.error, swr.isLoading, swr.isValidating]);

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
    authReady,
    authMode,
    isBootstrapping:
      !authReady ||
      (swrKey != null &&
        !hasResolvedInitialFetch &&
        (swr.isLoading || swr.isValidating || (swr.data === undefined && swr.error == null))),
    telegramUser: user,
    greetingName,
    releases,
    releaseStats,
    ...swr
  };
}
