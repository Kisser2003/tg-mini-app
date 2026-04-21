import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdminSupabaseClient } from "@/lib/admin-release-api-guard";
import { getTelegramAuthContextFromRequest } from "@/lib/api/with-telegram-auth";
import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases.repo";
import type { ModerationQueueApiRow } from "@/types/admin";

export const dynamic = "force-dynamic";

async function handleModerationQueue(request: NextRequest): Promise<Response> {
  const guard = await requireAdminSupabaseClient(request, getTelegramAuthContextFromRequest(request));
  if (!guard.ok) return guard.response;

  const { data: releases, error: relErr } = await guard.supabase
    .from("releases")
    .select("*")
    // Only truly submitted releases should appear in moderation queue.
    .eq("status", "processing")
    .order("created_at", { ascending: true });

  if (relErr) {
    console.error("[admin/moderation-queue] releases:", relErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить очередь." }, { status: 500 });
  }

  const list = releases ?? [];
  const rows: ModerationQueueApiRow[] = [];

  for (const release of list) {
    const { data: tracks, error: trErr } = await guard.supabase
      .from("tracks")
      .select("id, release_id, user_id, index, position, title, explicit, file_path, lyrics, duration")
      .eq("release_id", (release as { id: string }).id)
      .order("index", { ascending: true });

    if (trErr) {
      console.error("[admin/moderation-queue] tracks:", trErr.message);
      return NextResponse.json({ ok: false, error: "Не удалось загрузить треки." }, { status: 500 });
    }

    rows.push({
      release: release as ReleaseRecord,
      tracks: (tracks ?? []) as ReleaseTrackRow[]
    });
  }

  return NextResponse.json({ ok: true, rows });
}

export const GET = handleModerationQueue;
