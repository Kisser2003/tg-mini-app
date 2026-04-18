import { createClient } from "@supabase/supabase-js";
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { getTelegramUserIdForSupabaseRequests } from "./telegram";
import type { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

if (typeof window !== "undefined" && (!supabaseUrl || !supabaseAnonKey)) {
  console.error(
    "[supabase] Задайте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY (локально в .env.local, на Vercel — Environment Variables)."
  );
}

/**
 * Схема таблицы треков в БД: `public.tracks` (не `release_tracks`), см. миграцию
 * `supabase/migrations/20260330120000_tracks_table.sql` и тип `ReleaseTrackRow` в `repositories/releases.repo.ts`.
 */

/**
 * Кастомный fetch для динамической подстановки `x-telegram-user-id` под RLS (PostgREST request.headers).
 * Заголовки мержим через Headers, чтобы не ломать то, что передаёт Supabase-клиент.
 */
function createTelegramAwareFetch(): typeof fetch {
  return (input, init) => {
    const userId = getTelegramUserIdForSupabaseRequests();
    if (userId == null) {
      return fetch(input, init);
    }
    const headers = new Headers(init?.headers);
    headers.set("x-telegram-user-id", String(userId));
    return fetch(input, { ...init, headers });
  };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: createTelegramAwareFetch()
  }
  // Realtime при необходимости настраивается отдельно; для REST и Storage достаточно global.fetch.
});

/**
 * Supabase client для браузера (веб-логин).
 * Важно: @supabase/ssr createBrowserClient хранит сессию в cookies, чтобы
 * middleware (createServerClient) видел пользователя после signIn — иначе
 * только localStorage и редирект на /library снова упрётся в /login.
 */
export function createSupabaseBrowser() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

/**
 * Supabase client для middleware с поддержкой cookies
 * Используется для серверной проверки авторизации
 */
export function createSupabaseMiddleware(request: NextRequest, response: NextResponse) {
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      }
    }
  });
}
