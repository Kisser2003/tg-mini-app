/**
 * GET /api/auth/profile
 * 
 * Gets the current user's profile.
 * Works with BOTH:
 * - Telegram auth (via x-telegram-user-id header or initData)
 * - Web auth (via Supabase session token)
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getTelegramInitDataFromRequest } from "@/lib/api/get-telegram-init-data-from-request";
import { verifyTelegramInitData, parseTelegramInitDataWithoutVerification } from "@/lib/telegram-init-data.server";
import { getUserProfile, getUserProfileByTelegramId, getOrCreateTelegramUser } from "@/lib/auth/hybrid-auth";

export async function GET(request: NextRequest) {
  try {
    const admin = createSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Admin client not available" },
        { status: 500 }
      );
    }

    // Try Supabase Auth first (web)
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (token) {
      const {
        data: { user },
        error: authError
      } = await admin.auth.getUser(token);

      if (user && !authError) {
        const profile = await getUserProfile(user.id);
        if (profile) {
          return NextResponse.json({
            ok: true,
            user: profile,
            auth_method: "supabase"
          });
        }
      }
    }

    // Try Telegram Auth (Mini App)
    const initDataRaw = getTelegramInitDataFromRequest(request);
    if (initDataRaw) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        return NextResponse.json(
          { ok: false, error: "Bot token not configured" },
          { status: 500 }
        );
      }

      // Try full verification first
      let verified = verifyTelegramInitData(initDataRaw, botToken);
      
      // In development, allow looser validation
      if (!verified && process.env.NODE_ENV === "development") {
        const devUserIdHeader = request.headers.get("x-dev-telegram-user-id");
        const parsed = parseTelegramInitDataWithoutVerification(initDataRaw);
        
        if (parsed && devUserIdHeader && Number(devUserIdHeader) === parsed.user.id) {
          console.warn("[profile] DEV: Using unverified initData with matching dev header");
          verified = parsed;
        }
      }

      if (verified) {
        // Get or create user profile for Telegram user
        const profile = await getOrCreateTelegramUser(verified.user);
        if (profile) {
          return NextResponse.json({
            ok: true,
            user: profile,
            auth_method: "telegram"
          });
        }
      }
    }

    // No valid authentication found
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  } catch (error) {
    console.error("[profile] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
