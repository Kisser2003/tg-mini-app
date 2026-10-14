import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withTelegramAuth, type TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getReferralSummary } from "@/lib/server/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Свой реферальный код (создаётся при первом запросе), ссылка и счётчики. Только Telegram. */
async function handleGetReferral(_request: NextRequest, ctx: TelegramAuthContext): Promise<Response> {
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }
  const summary = await getReferralSummary(admin, String(ctx.user.id));
  if (!summary) {
    return NextResponse.json({ ok: false, error: "Не удалось загрузить приглашения." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, referral: summary });
}

export const GET = withTelegramAuth(handleGetReferral);
