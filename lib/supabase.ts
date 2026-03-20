import { createClient } from "@supabase/supabase-js";
import { getExpectedAdminTelegramId } from "./admin";
import { getTelegramUserId } from "./telegram";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * ID для заголовка `x-telegram-user-id`: реальный пользователь или в development без Telegram — ID админа (RLS).
 */
function getTelegramUserIdForRequest(): number | null {
  const id = getTelegramUserId();
  if (id != null) return id;
  if (process.env.NODE_ENV === "development") {
    return getExpectedAdminTelegramId();
  }
  return null;
}

/**
 * Кастомный fetch для динамической подстановки `x-telegram-user-id` под RLS (PostgREST request.headers).
 * Заголовки мержим через Headers, чтобы не ломать то, что передаёт Supabase-клиент.
 */
function createTelegramAwareFetch(): typeof fetch {
  return (input, init) => {
    const userId = getTelegramUserIdForRequest();
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
