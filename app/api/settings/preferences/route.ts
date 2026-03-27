import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import { supabase } from "@/lib/supabase";

export type UserPreferences = {
  user_id: number;
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
  const userId = ctx.user.id;

  const { data, error } = await supabase
    .from("user_preferences")
    .select(
      "user_id, push_notifications, payout_method, payout_details, updated_at"
    )
    .eq("user_id", userId)
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
        user_id: userId,
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
  const userId = ctx.user.id;

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
    user_id: userId,
    ...parsed.data
  };

  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(payload, { onConflict: "user_id" })
    .select("user_id, push_notifications, payout_method, payout_details, updated_at")
    .maybeSingle();

  if (error) {
    console.error("[settings/preferences POST]", error.message);
    return NextResponse.json({ ok: false, error: "Не удалось сохранить настройки." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, preferences: data as UserPreferences });
}

export const POST = withTelegramAuth(handlePostPreferences);
