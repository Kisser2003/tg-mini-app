import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn("Supabase env vars are not set");
}

export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey);

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseServer = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

