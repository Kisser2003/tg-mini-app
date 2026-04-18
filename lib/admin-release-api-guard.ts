import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { getExpectedAdminTelegramId, telegramIdsEqual } from "@/lib/admin";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type AdminGuardResult =
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; response: Response };

/**
 * Проверка Telegram admin + service role клиент для админ-API релизов.
 */
export function requireAdminSupabaseClient(ctx: TelegramAuthContext): AdminGuardResult {
  let adminId: number;
  try {
    adminId = getExpectedAdminTelegramId();
  } catch (e) {
    console.error("[admin-release-api]", e);
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 503 })
    };
  }

  if (!telegramIdsEqual(ctx.user.id, adminId)) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }

  const supabase = createSupabaseAdmin();
  if (!supabase) {
    console.error("[admin-release-api] missing Supabase service role");
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 503 })
    };
  }

  return { ok: true, supabase };
}
