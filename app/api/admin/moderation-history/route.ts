import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdminSupabaseClient } from "@/lib/admin-release-api-guard";
import { getTelegramAuthContextFromRequest } from "@/lib/api/with-telegram-auth";
import type { ReleaseRecord } from "@/repositories/releases.repo";
import { attachTracksToReleases, loadTracksForReleases } from "@/lib/server/admin-release-rows";
import type { ModerationQueueApiRow } from "@/types/admin";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

async function handleModerationHistory(request: NextRequest): Promise<Response> {
  const guard = await requireAdminSupabaseClient(request, getTelegramAuthContextFromRequest(request));
  if (!guard.ok) return guard.response;

  const limitRaw = request.nextUrl.searchParams.get("limit");
  const parsed = limitRaw != null ? Number.parseInt(limitRaw, 10) : NaN;
  const limit = Number.isFinite(parsed)
    ? Math.min(MAX_LIMIT, Math.max(1, parsed))
    : DEFAULT_LIMIT;

  const { data: releases, error: relErr } = await guard.supabase
    .from("releases")
    .select("*")
    .in("status", ["ready", "failed"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (relErr) {
    console.error("[admin/moderation-history] releases:", relErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить историю." }, { status: 500 });
  }

  const list = releases ?? [];
  if (list.length === 0) {
    return NextResponse.json({ ok: true, rows: [], truncated: false });
  }

  const tracks = await loadTracksForReleases(
    guard.supabase,
    (list as ReleaseRecord[]).map((r) => r.id)
  );
  if (tracks == null) {
    return NextResponse.json({ ok: false, error: "Не удалось загрузить треки." }, { status: 500 });
  }
  const rows: ModerationQueueApiRow[] = attachTracksToReleases(list as ReleaseRecord[], tracks);

  return NextResponse.json({
    ok: true,
    rows,
    truncated: list.length >= limit
  });
}

export const GET = handleModerationHistory;
