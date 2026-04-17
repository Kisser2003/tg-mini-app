import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUserProfileByTelegramId } from "@/lib/auth/hybrid-auth";

/**
 * Migrates releases and tracks to use user_uuid (hybrid auth schema).
 * Updates records where telegram_id matches but user_uuid is not set.
 * 
 * DEPRECATED: This is a migration helper. After full migration to UUID schema,
 * all new records should use user_uuid directly.
 */
async function handleAlign(_request: NextRequest, ctx: { user: { id: number } }): Promise<Response> {
  const tg = Math.trunc(ctx.user.id);
  if (!Number.isFinite(tg) || tg <= 0) {
    return NextResponse.json({ ok: false, error: "invalid user" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 503 });
  }

  // Get user UUID from Telegram ID
  const userProfile = await getUserProfileByTelegramId(BigInt(tg));
  if (!userProfile) {
    return NextResponse.json({ ok: false, error: "User profile not found" }, { status: 404 });
  }

  // Update releases to use user_uuid
  const { error: relErr } = await admin
    .from("releases")
    .update({ user_uuid: userProfile.id, user_id: String(tg), telegram_id: String(tg) })
    .eq("telegram_id", String(tg))
    .is("user_uuid", null);

  if (relErr) {
    console.error("[identity/align-releases] releases update:", relErr.message);
    return NextResponse.json({ ok: false, error: relErr.message }, { status: 500 });
  }

  // Update tracks to use user_uuid
  const { error: trErr, data: updatedTracks } = await admin
    .from("tracks")
    .update({ user_uuid: userProfile.id })
    .eq("telegram_id", String(tg))
    .is("user_uuid", null)
    .select("id");

  if (trErr) {
    console.error("[identity/align-releases] tracks update:", trErr.message);
    return NextResponse.json({ ok: false, error: trErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    telegramId: tg,
    userUuid: userProfile.id,
    updated: {
      releases: "migrated",
      tracks: updatedTracks?.length || 0
    }
  });
}

export const POST = withTelegramAuth(handleAlign);
