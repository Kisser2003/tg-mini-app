"use client";

import useSWR from "swr";
import { createSupabaseBrowser } from "@/lib/supabase";
import type { UserProfile } from "@/lib/auth/hybrid-auth";

async function fetchAuthProfile(): Promise<UserProfile | null> {
  const supabase = createSupabaseBrowser();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  const res = await fetch("/api/auth/profile", {
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { ok?: boolean; user?: UserProfile };
  if (!json.ok || !json.user) return null;
  return json.user;
}

/**
 * Профиль из public.users (GET /api/auth/profile) для веб-сессии.
 * Для Telegram Mini App без JWT обычно null — используйте данные из useReleases.
 */
export function useAuthProfile(enabled: boolean, sessionUserId: string | null) {
  return useSWR(
    enabled && sessionUserId ? (["auth-profile", sessionUserId] as const) : null,
    fetchAuthProfile,
    {
      revalidateOnFocus: true,
      dedupingInterval: 60_000
    }
  );
}

/**
 * Имя для приветствия: сценическое/имя из профиля, не логин почты.
 */
export function pickProfileGreetingName(
  profile: UserProfile | null | undefined,
  fallbackFromHook: string
): string {
  const display = profile?.display_name?.trim();
  if (display) return display;

  const tgFirst = profile?.telegram_first_name?.trim();
  if (tgFirst) return tgFirst;

  const email = profile?.email?.trim();
  if (email && !email.includes("@temp.local") && !email.startsWith("telegram_")) {
    const local = email.split("@")[0]?.trim();
    if (local) return local;
  }

  return fallbackFromHook;
}
