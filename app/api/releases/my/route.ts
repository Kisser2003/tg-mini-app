import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveReleaseActor } from "@/lib/api/resolve-submit-actor";
import type { ReleaseRecord } from "@/repositories/releases.repo";

export const dynamic = "force-dynamic";

async function handleGetMyReleases(request: NextRequest): Promise<Response> {
  const actor = await resolveReleaseActor(request);
  console.log("[API-DEBUG] resolveReleaseActor result", {
    actor: actor
      ? {
          kind: actor.kind,
          source:
            "source" in actor && typeof actor.source === "string" ? actor.source : "no-source-field"
        }
      : null,
    cookies: request.headers.get("cookie")?.includes("tg_init_data")
      ? "has tg_init_data"
      : "NO tg_init_data cookie",
    hasInitDataHeader: !!request.headers.get("x-telegram-init-data"),
    hasTelegramUserIdHeader: !!request.headers.get("x-telegram-user-id")
  });
  if (!actor) {
    // Last resort: try x-telegram-user-id header directly
    const rawUid = request.headers.get("x-telegram-user-id");
    const fallbackUid = rawUid ? Math.trunc(Number(rawUid)) : null;

    if (fallbackUid && Number.isFinite(fallbackUid) && fallbackUid > 0) {
      // Treat as telegram actor with just the userId
      const admin = createSupabaseAdmin();
      if (admin) {
        const tid = String(fallbackUid);
        const { data } = await admin
          .from("releases")
          .select("*")
          .or(`user_id.eq.${tid},telegram_id.eq.${tid}`)
          .order("created_at", { ascending: false });
        return NextResponse.json({ ok: true, rows: data ?? [] });
      }
    }

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

