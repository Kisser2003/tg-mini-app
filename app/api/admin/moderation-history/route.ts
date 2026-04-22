import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdminSupabaseClient } from "@/lib/admin-release-api-guard";
import { getTelegramAuthContextFromRequest } from "@/lib/api/with-telegram-auth";
import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases.repo";
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

  const ids = list.map((r) => (r as { id: string }).id);
  const { data: allTracks, error: trErr } = await guard.supabase
    .from("tracks")
    .select("id, release_id, user_id, index, position, title, explicit, file_path, lyrics, duration")
    .in("release_id", ids)
    .order("index", { ascending: true });

  if (trErr) {
    console.error("[admin/moderation-history] tracks:", trErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить треки." }, { status: 500 });
  }

  const byRelease = new Map<string, ReleaseTrackRow[]>();
  for (const t of allTracks ?? []) {
    const rid = (t as { release_id: string | null }).release_id;
    if (rid == null) continue;
    const arr = byRelease.get(rid);
    const row = t as ReleaseTrackRow;
    if (arr) arr.push(row);
    else byRelease.set(rid, [row]);
  }
  for (const arr of byRelease.values()) {
    arr.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  }

  const rows: ModerationQueueApiRow[] = list.map((release) => ({
    release: release as ReleaseRecord,
    tracks: byRelease.get((release as { id: string }).id) ?? []
  }));

  return NextResponse.json({
    ok: true,
    rows,
    truncated: list.length >= limit
  });
}

export const GET = handleModerationHistory;
