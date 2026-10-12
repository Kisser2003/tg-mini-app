import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveReleaseActor } from "@/lib/api/resolve-submit-actor";
import type { ReleaseRecord } from "@/repositories/releases.repo";
import { getJsonCache, setJsonCache } from "@/lib/server/redis-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RELEASE_LIST_SELECT = [
  "id",
  "title",
  "track_name",
  "artist_name",
  "artwork_url",
  "status",
  "created_at",
  "error_message",
  "admin_notes",
  "draft_upload_started",
  "isrc",
  "upc",
  "release_type",
  "smart_link"
].join(",");
const RELEASES_CACHE_TTL_SECONDS = 20;
type ReleaseListRow = Pick<
  ReleaseRecord,
  | "id"
  | "title"
  | "track_name"
  | "artist_name"
  | "artwork_url"
  | "status"
  | "created_at"
  | "error_message"
  | "admin_notes"
  | "draft_upload_started"
  | "isrc"
  | "upc"
  | "release_type"
  | "smart_link"
>;

async function handleGetMyReleases(request: NextRequest): Promise<Response> {
  const actor = await resolveReleaseActor(request);
  const cacheScope =
    actor?.kind === "telegram"
      ? `tg:${actor.telegramUserId}`
      : actor?.kind === "web"
        ? `web:${actor.authUserId}`
        : null;
  const cacheKey = cacheScope ? `releases:my:${cacheScope}` : null;

  if (cacheKey) {
    const cachedRows = await getJsonCache<ReleaseListRow[]>(cacheKey);
    if (Array.isArray(cachedRows)) {
      return NextResponse.json({ ok: true, rows: cachedRows, cached: true });
    }
  }

  if (!actor) {
    // Dev-only: в production голому заголовку доверять нельзя (IDOR через service role).
    const rawUid = process.env.NODE_ENV !== "production" ? request.headers.get("x-telegram-user-id") : null;
    const fallbackUid = rawUid ? Math.trunc(Number(rawUid)) : null;

    if (fallbackUid && Number.isFinite(fallbackUid) && fallbackUid > 0) {
      // Treat as telegram actor with just the userId
      const admin = createSupabaseAdmin();
      if (admin) {
        const tid = String(fallbackUid);
        const { data } = await admin
          .from("releases")
          .select(RELEASE_LIST_SELECT)
          .or(`user_id.eq.${tid},telegram_id.eq.${tid}`)
          .order("created_at", { ascending: false });
        const rows = (data ?? []) as unknown as ReleaseListRow[];
        await setJsonCache(`releases:my:tg:${tid}`, rows, RELEASES_CACHE_TTL_SECONDS);
        return NextResponse.json({ ok: true, rows });
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

  let query = admin.from("releases").select(RELEASE_LIST_SELECT).order("created_at", { ascending: false });

  if (actor.kind === "telegram") {
    const tid = String(actor.telegramUserId);
    const { data: profiles } = await admin
      .from("users")
      .select("id")
      .eq("telegram_id", tid)
      .limit(10);
    const profileUuids = Array.isArray(profiles)
      ? profiles
          .map((p) => (typeof (p as { id?: unknown }).id === "string" ? (p as { id: string }).id : null))
          .filter((id): id is string => id != null)
      : [];
    const orParts = [`user_id.eq.${tid}`, `telegram_id.eq.${tid}`];
    if (profileUuids.length > 0) {
      // Support multi-linked/legacy rows: include all matching profile UUIDs.
      orParts.push(`user_uuid.in.(${profileUuids.join(",")})`);
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

  const rows = (data ?? []) as unknown as ReleaseListRow[];
  if (cacheKey) {
    await setJsonCache(cacheKey, rows, RELEASES_CACHE_TTL_SECONDS);
  }
  return NextResponse.json({ ok: true, rows });
}

export const GET = handleGetMyReleases;

