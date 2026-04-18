import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

/**
 * Серверный клиент Supabase с чтением сессии из cookies (email / magic link).
 * Для Route Handlers (App Router).
 */
export function createSupabaseServerClientFromCookies() {
  const cookieStore = cookies();
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* set может быть недоступен в некоторых контекстах */
        }
      }
    }
  });
}

export async function getSupabaseAuthUserIdFromCookies(): Promise<string | null> {
  const supabase = createSupabaseServerClientFromCookies();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}
