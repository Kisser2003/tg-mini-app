import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withTelegramAuth, type TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { getTelegramInitDataFromRequest } from "@/lib/api/get-telegram-init-data-from-request";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { attributeReferral } from "@/lib/server/referrals";
import { parseReferralStartParam } from "@/lib/referral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Привязка друга по ссылке `?startapp=ref_<code>`. Код берём только из start_param подписанного
 * initData (тот же, что проверил withTelegramAuth), а не из тела запроса — подставить чужой код нельзя.
 */
async function handleAttribute(request: NextRequest, ctx: TelegramAuthContext): Promise<Response> {
  const raw = getTelegramInitDataFromRequest(request);
  const code = parseReferralStartParam(raw ? new URLSearchParams(raw).get("start_param") : null);
  if (!code) {
    return NextResponse.json({ ok: false, error: "Нет кода приглашения." }, { status: 400 });
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }
  const result = await attributeReferral(admin, String(ctx.user.id), code);
  if (result === "error") {
    return NextResponse.json({ ok: false, error: "Не получилось применить приглашение." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, result });
}

export const POST = withTelegramAuth(handleAttribute);
