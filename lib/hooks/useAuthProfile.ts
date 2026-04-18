"use client";

import useSWR from "swr";
import { createSupabaseBrowser } from "@/lib/supabase";
import type { UserProfile } from "@/lib/auth/hybrid-auth";

const USERS_PROFILE_COLUMNS =
  "id, telegram_id, telegram_username, telegram_first_name, telegram_last_name, email, display_name, account_linked_at, created_at, updated_at" as const;

/**
 * Прямое чтение своей строки в public.users (RLS: auth.uid() = id).
 * Нужно, если /api/auth/profile недоступен (нет service role на сервере и т.п.) —
 * иначе имя из БД не попадёт в приветствие.
 */
async function fetchProfileFromPublicUsers(
  userId: string
): Promise<UserProfile | null> {
  const supabase = createSupabaseBrowser();
  const { data, error } = await supabase
    .from("users")
    .select(USERS_PROFILE_COLUMNS)
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data as unknown as UserProfile;
}

async function fetchAuthProfile(): Promise<UserProfile | null> {
  const supabase = createSupabaseBrowser();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session?.access_token || !session.user?.id) return null;

  const res = await fetch("/api/auth/profile", {
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  if (res.ok) {
    const json = (await res.json()) as { ok?: boolean; user?: UserProfile };
    if (json.ok && json.user) return json.user;
  }

  return fetchProfileFromPublicUsers(session.user.id);
}

/**
 * Профиль из public.users: сначала GET /api/auth/profile, иначе прямой select по RLS.
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
