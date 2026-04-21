import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveReleaseActor } from "@/lib/api/resolve-submit-actor";
import type { ReleaseRecord } from "@/repositories/releases.repo";

export const dynamic = "force-dynamic";

async function handleGetMyReleases(request: NextRequest): Promise<Response> {
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

  let query = admin.from("releases").select("*").order("created_at", { ascending: false });

  if (actor.kind === "telegram") {
    const tid = String(actor.telegramUserId);
    let profileUuid: string | null = null;
    const { data: profile } = await admin
      .from("users")
      .select("id")
      .eq("telegram_id", tid)
      .maybeSingle();
    if (profile && typeof (profile as { id?: unknown }).id === "string") {
      profileUuid = (profile as { id: string }).id;
    }
    const orParts = [`user_id.eq.${tid}`, `telegram_id.eq.${tid}`];
    if (profileUuid) {
      orParts.push(`user_uuid.eq.${profileUuid}`);
    }
    query = query.or(orParts.join(","));
  } else {
    query = query.eq("user_uuid", actor.authUserId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[releases/my] fetch:", error.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить релизы." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: (data ?? []) as ReleaseRecord[] });
}

export const GET = handleGetMyReleases;

