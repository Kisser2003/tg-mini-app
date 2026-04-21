import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Critical runtime configuration required for the production music distribution app.
 * These are validated for deployment health checks and E2E smoke tests.
 */
const CRITICAL_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TELEGRAM_BOT_TOKEN",
  "ADMIN_TELEGRAM_ID",
  "NEXT_PUBLIC_ADMIN_TELEGRAM_ID",
  "SUPABASE_WEBHOOK_SECRET"
] as const;

function isMissingEnvKey(key: (typeof CRITICAL_ENV_KEYS)[number]): boolean {
  const value = process.env[key];
  return typeof value !== "string" || value.trim().length === 0;
}

function getMissingCriticalEnvKeys(): string[] {
  return CRITICAL_ENV_KEYS.filter(isMissingEnvKey);
}

export async function GET(): Promise<Response> {
  const missing = getMissingCriticalEnvKeys();
  if (missing.length === 0) {
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  // Do not leak key names in production responses.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  return NextResponse.json(
    { status: "error", missingCount: missing.length, missingKeys: missing },
    { status: 500 }
  );
}

