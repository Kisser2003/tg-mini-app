import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveReleaseActor } from "@/lib/api/resolve-submit-actor";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  message: z.string().trim().min(3).max(4000),
  route: z.string().trim().max(512).optional(),
  userAgent: z.string().trim().max(1024).optional()
});

export async function POST(request: NextRequest) {
  const actor = await resolveReleaseActor(request);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 503 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Некорректный формат сообщения." }, { status: 400 });
  }

  const userId = actor.kind === "telegram" ? actor.telegramUserId : null;
  const userUuid = actor.kind === "web" ? actor.authUserId : null;
  const { message, route, userAgent } = parsed.data;

  const { error } = await admin.from("feedback").insert({
    user_id: userId,
    user_uuid: userUuid,
    message,
    route: route ?? null,
    user_agent: userAgent ?? null
  });

  if (error) {
    console.error("[feedback] insert failed:", error.message);
    return NextResponse.json({ ok: false, error: "Не удалось отправить сообщение." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
