"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { initUserContextInStore } from "@/features/release/createRelease/actions";
import {
  getMyReleases,
  getMyReleasesForWebUser,
  type ReleaseRecord
} from "@/repositories/releases.repo";
import {
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
  | "artwork_url"
  | "status"
  | "created_at"
  | "error_message"
  | "admin_notes"
  | "draft_upload_started"
  | "isrc"
>;

const RELEASES_LIST_TIMEOUT_MS = 15000;

type ReleasesSwrKey =
  | readonly ["releases", "telegram", string]
  | readonly ["releases", "web", string];

async function fetchReleasesTelegram([, , uid]: readonly ["releases", "telegram", string]): Promise<
  ReleaseListRow[]
> {
  const rows = await withRequestTimeout(
    getMyReleases(uid),
    RELEASES_LIST_TIMEOUT_MS,
    USER_REQUEST_TIMEOUT_MESSAGE
  );
  return rows as ReleaseListRow[];
}

async function fetchReleasesWeb([, , _authUid]: readonly ["releases", "web", string]): Promise<
  ReleaseListRow[]
> {
  const client = createSupabaseBrowser();
  const rows = await withRequestTimeout(
    getMyReleasesForWebUser(client),
    RELEASES_LIST_TIMEOUT_MS,
    USER_REQUEST_TIMEOUT_MESSAGE
  );
  return rows as ReleaseListRow[];
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

  useEffect(() => {
    let cancelled = false;
    initTelegramWebApp();
    initUserContextInStore();

    const applyTelegramMode = (tid: number) => {
      if (cancelled) return;
      setUser(getTelegramWebApp()?.initDataUnsafe?.user ?? null);
      setUserId(String(tid));
      setAuthMode("telegram");
      const tg = getTelegramWebApp()?.initDataUnsafe?.user;
      const name =
        tg?.first_name?.trim() ||
        tg?.username?.trim() ||
        "Артист";
      setGreetingName(name);
      setAuthReady(true);
    };

    const tidNow = getTelegramUserIdForSupabaseRequests();
    if (tidNow != null) {
      applyTelegramMode(tidNow);
      return () => {
        cancelled = true;
      };
    }

    const supabase = createSupabaseBrowser();

    const applySession = (session: Session | null) => {
      if (cancelled) return;
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
        setUserId(null);
        setAuthMode(null);
        setGreetingName("Артист");
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
      }
    }, 50);
    const pollStop = window.setTimeout(() => {
      window.clearInterval(poll);
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearTimeout(pollStop);
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
    telegramUser: user,
    greetingName,
    releases,
    releaseStats,
    ...swr
  };
}
