import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Склеивает user_id с telegram_id для строк, где telegram_id уже совпадает с текущим пользователем Mini App,
 * но user_id отличается (например, после тестов с другим id). Только service role.
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

  const { error: relErr } = await admin
    .from("releases")
    .update({ user_id: tg, telegram_id: tg })
    .eq("telegram_id", tg)
    .neq("user_id", tg);

  if (relErr) {
    console.error("[identity/align-releases] releases update:", relErr.message);
    return NextResponse.json({ ok: false, error: relErr.message }, { status: 500 });
  }

  const { error: trErr } = await admin
    .from("tracks")
    .update({ user_id: tg, telegram_id: tg })
    .eq("telegram_id", tg)
    .neq("user_id", tg);

  if (trErr) {
    console.error("[identity/align-releases] tracks update:", trErr.message);
    return NextResponse.json({ ok: false, error: trErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, telegramId: tg });
}

export const POST = withTelegramAuth(handleAlign);
