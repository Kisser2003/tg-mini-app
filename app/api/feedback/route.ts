import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  route: z.string().max(512).optional()
});

async function handleFeedback(
  request: NextRequest,
  ctx: TelegramAuthContext
): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation failed" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 503 });
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;

  const { error } = await admin.from("feedback").insert({
    user_id: ctx.user.id,
    message: parsed.data.message,
    route: parsed.data.route ?? null,
    user_agent: userAgent
  });

  if (error) {
    console.error("[api/feedback]", error.message);
    return NextResponse.json({ ok: false, error: "Save failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withTelegramAuth(handleFeedback);
