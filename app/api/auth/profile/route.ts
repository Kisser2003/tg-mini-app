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
import type { UserProfile } from "@/lib/auth/hybrid-auth";

/** Не пытаться статически прогонять хендлер при `next build` — `request.headers` тянет dynamic `headers()`. */
export const dynamic = "force-dynamic";

/** Bigint из PostgREST нельзя сериализовать в JSON — иначе 500 и пустой профиль на клиенте. */
function profileToJsonSafe(profile: UserProfile): Record<string, unknown> {
  return {
    ...profile,
    telegram_id:
      profile.telegram_id == null
        ? null
        : typeof profile.telegram_id === "bigint"
          ? profile.telegram_id.toString()
          : profile.telegram_id
  };
}

export async function GET(request: NextRequest) {
  try {
    const admin = createSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Admin client not available" },
        { status: 500 }
      );
    }

    // Try Telegram Auth first (Mini App): if initData is present, it should win over stale web tokens.
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
            user: profileToJsonSafe(profile),
            auth_method: "telegram"
          });
        }
      }
    }

    // Fallback to Supabase Auth (web)
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
            user: profileToJsonSafe(profile),
            auth_method: "supabase"
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
