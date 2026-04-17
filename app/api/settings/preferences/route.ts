import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUserProfileByTelegramId } from "@/lib/auth/hybrid-auth";

export type UserPreferences = {
  user_uuid: string;
  push_notifications: boolean;
  payout_method: string | null;
  payout_details: Record<string, unknown> | null;
  updated_at: string;
};

// ─── GET ─────────────────────────────────────────────────────────────────────

async function handleGetPreferences(
  _request: NextRequest,
  ctx: TelegramAuthContext
): Promise<Response> {
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }

  // Get user UUID from Telegram ID
  const userProfile = await getUserProfileByTelegramId(BigInt(ctx.user.id));
  if (!userProfile) {
    return NextResponse.json({ ok: false, error: "User profile not found" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("user_preferences")
    .select(
      "user_uuid, push_notifications, payout_method, payout_details, updated_at"
    )
    .eq("user_uuid", userProfile.id)
    .maybeSingle();

  if (error) {
    console.error("[settings/preferences GET]", error.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить настройки." }, { status: 500 });
  }

  if (!data) {
    // Return defaults when the row doesn't exist yet
    return NextResponse.json({
      ok: true,
      preferences: {
        user_uuid: userProfile.id,
        push_notifications: true,
        payout_method: null,
        payout_details: null,
        updated_at: new Date().toISOString()
      } satisfies UserPreferences
    });
  }

  return NextResponse.json({ ok: true, preferences: data as UserPreferences });
}

export const GET = withTelegramAuth(handleGetPreferences);

// ─── POST (upsert) ────────────────────────────────────────────────────────────

const upsertSchema = z.object({
  push_notifications: z.boolean().optional(),
  payout_method: z.enum(["bank_card", "crypto", "paypal"]).nullable().optional(),
  payout_details: z.record(z.string(), z.unknown()).nullable().optional()
});

async function handlePostPreferences(
  request: NextRequest,
  ctx: TelegramAuthContext
): Promise<Response> {
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }

  // Get user UUID from Telegram ID
  const userProfile = await getUserProfileByTelegramId(BigInt(ctx.user.id));
  if (!userProfile) {
    return NextResponse.json({ ok: false, error: "User profile not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Неверный формат тела запроса." }, { status: 400 });
  }

  const parsed = upsertSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Некорректные данные.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = {
    user_uuid: userProfile.id,
    ...parsed.data
  };

  const { data, error } = await admin
    .from("user_preferences")
    .upsert(payload, { onConflict: "user_uuid" })
    .select("user_uuid, push_notifications, payout_method, payout_details, updated_at")
    .maybeSingle();

  if (error) {
    console.error("[settings/preferences POST]", error.message);
    return NextResponse.json({ ok: false, error: "Не удалось сохранить настройки." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, preferences: data as UserPreferences });
}

export const POST = withTelegramAuth(handlePostPreferences);
