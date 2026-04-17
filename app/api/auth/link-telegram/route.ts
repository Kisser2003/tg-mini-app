/**
 * POST /api/auth/link-telegram
 * 
 * Links a Telegram account to an existing email/password account.
 * Requires:
 * - Valid Telegram initData (Telegram user authenticated)
 * - Valid Supabase session (email user authenticated)
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getTelegramInitDataFromRequest } from "@/lib/api/get-telegram-init-data-from-request";
import { verifyTelegramInitData } from "@/lib/telegram-init-data.server";
import { linkTelegramToEmailAccount } from "@/lib/auth/hybrid-auth";

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Telegram authentication
    const initDataRaw = getTelegramInitDataFromRequest(request);
    if (!initDataRaw) {
      return NextResponse.json(
        { ok: false, error: "Missing Telegram init data" },
        { status: 401 }
      );
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { ok: false, error: "Bot token not configured" },
        { status: 500 }
      );
    }

    const verified = verifyTelegramInitData(initDataRaw, botToken);
    if (!verified) {
      return NextResponse.json(
        { ok: false, error: "Invalid Telegram signature" },
        { status: 401 }
      );
    }

    // 2. Verify Supabase authentication (email user)
    const admin = createSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Admin client not available" },
        { status: 500 }
      );
    }

    // Get the auth token from request (cookie or Authorization header)
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated with email account" },
        { status: 401 }
      );
    }

    // Verify the token
    const {
      data: { user },
      error: authError
    } = await admin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: "Invalid session token" },
        { status: 401 }
      );
    }

    // 3. Link accounts
    const result = await linkTelegramToEmailAccount(user.id, verified.user);

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          code: result.code
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: result.message,
      user_id: result.user_id
    });
  } catch (error) {
    console.error("[link-telegram] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
