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

const supabaseClientOptions = {
  global: {
    fetch: createTelegramAwareFetch()
  }
};

function hasSupabasePublicConfig(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function missingSupabasePublicConfigError(): Error {
  return new Error(
    "Supabase public config is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel environment variables."
  );
}

let browserSupabaseSingleton: ReturnType<typeof createBrowserClient<Database>> | null = null;

function getOrCreateBrowserSupabaseClient() {
  if (!hasSupabasePublicConfig()) {
    throw missingSupabasePublicConfigError();
  }
  if (browserSupabaseSingleton) return browserSupabaseSingleton;
  browserSupabaseSingleton = createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    supabaseClientOptions
  );
  return browserSupabaseSingleton;
}

/**
 * Один клиент для REST/Storage в браузере: сессия в cookies (как у логина) + заголовок
 * `x-telegram-user-id` в Mini App. Раньше был только `createClient` (localStorage) —
 * JWT после email-входа не совпадал с `createSupabaseBrowser`, RLS ломался на вебе.
 */
/**
 * Backward-compatible exported client.
 * IMPORTANT: lazy proxy prevents immediate crash on module import when env vars are missing.
 */
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient<Database>>, {
  get(_target, prop) {
    const client =
      typeof window !== "undefined"
        ? getOrCreateBrowserSupabaseClient()
        : createClient<Database>(supabaseUrl, supabaseAnonKey, supabaseClientOptions);
    const value = Reflect.get(client as object, prop);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  }
});

/**
 * Supabase client для браузера (веб-логин).
 * Совпадает по настройкам с `supabase` в клиенте (cookies + telegram fetch).
 */
export function createSupabaseBrowser() {
  return getOrCreateBrowserSupabaseClient();
}

/**
 * Supabase client для middleware с поддержкой cookies
 * Используется для серверной проверки авторизации
 */
export function createSupabaseMiddleware(request: NextRequest, response: NextResponse) {
  if (!hasSupabasePublicConfig()) {
    throw missingSupabasePublicConfigError();
  }
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
