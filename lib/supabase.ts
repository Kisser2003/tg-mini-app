import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const missingEnvMessage =
  "Supabase env vars are missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";

let supabaseInstance: SupabaseClient | null = null;

function createMissingEnvProxy(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(missingEnvMessage);
    }
  });
}

export function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;
  if (!supabaseUrl || !supabaseKey) {
    console.error("[supabase] missing NEXT_PUBLIC env vars");
    supabaseInstance = createMissingEnvProxy();
    return supabaseInstance;
  }
  supabaseInstance = createClient(supabaseUrl, supabaseKey);
  return supabaseInstance;
}

export const supabase = getSupabaseClient();

