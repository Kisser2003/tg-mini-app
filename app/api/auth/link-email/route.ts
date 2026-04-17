/**
 * POST /api/auth/link-email
 * 
 * Links an email/password to an existing Telegram-only account.
 * Requires:
 * - Valid Telegram initData (user authenticated via Telegram)
 * - email and password in request body
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import { getUserProfileByTelegramId, linkEmailToTelegramAccount } from "@/lib/auth/hybrid-auth";

const linkEmailSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

export const POST = withTelegramAuth(async (request, telegramContext) => {
  try {
    const body = await request.json();
    const validation = linkEmailSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid request data",
          details: validation.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    // Get the user profile by Telegram ID
    const userProfile = await getUserProfileByTelegramId(BigInt(telegramContext.user.id));
    if (!userProfile) {
      return NextResponse.json(
        { ok: false, error: "User profile not found" },
        { status: 404 }
      );
    }

    // Check if user already has email linked
    if (
      userProfile.email &&
      !userProfile.email.includes("@temp.local") &&
      !userProfile.email.startsWith("telegram_")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "This account already has an email linked",
          code: "EMAIL_ALREADY_LINKED"
        },
        { status: 400 }
      );
    }

    // Link email and password
    const result = await linkEmailToTelegramAccount(userProfile.id, email, password);

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
    console.error("[link-email] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
});
