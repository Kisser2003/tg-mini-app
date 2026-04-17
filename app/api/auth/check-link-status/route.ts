/**
 * GET /api/auth/check-link-status
 * 
 * Checks if the current user's account has both Telegram and Email linked.
 * Requires Telegram authentication.
 */

import { NextResponse } from "next/server";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import { getUserProfileByTelegramId } from "@/lib/auth/hybrid-auth";

export const GET = withTelegramAuth(async (request, telegramContext) => {
  try {
    const profile = await getUserProfileByTelegramId(BigInt(telegramContext.user.id));
    
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "User profile not found" },
        { status: 404 }
      );
    }

    const hasTelegram = Boolean(profile.telegram_id);
    const hasEmail = Boolean(
      profile.email &&
      !profile.email.includes("@temp.local") &&
      !profile.email.startsWith("telegram_")
    );

    return NextResponse.json({
      ok: true,
      user_id: profile.id,
      has_telegram: hasTelegram,
      has_email: hasEmail,
      is_fully_linked: hasTelegram && hasEmail,
      account_linked_at: profile.account_linked_at,
      email: hasEmail ? profile.email : null,
      telegram_username: profile.telegram_username,
      display_name: profile.display_name
    });
  } catch (error) {
    console.error("[check-link-status] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
});
