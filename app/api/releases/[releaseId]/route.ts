import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, loadOwnedRelease, RELEASE_TRACKS_SELECT } from "@/lib/api/release-owner-route";
import { loadSubmittedAt } from "@/lib/server/release-submitted-at";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const paramsSchema = z.object({ releaseId: z.string().uuid() });

/**
 * Релиз владельца (или Telegram-админа). `?tracks=1` — вместе с треками, отсортированными по `index`.
 */
async function handleGetOwnRelease(
  request: NextRequest,
  routeContext: { params: { releaseId: string } }
): Promise<Response> {
  const parsed = paramsSchema.safeParse(routeContext.params);
  if (!parsed.success) {
    return jsonError(400, "Некорректный ID релиза.");
  }
  const { releaseId } = parsed.data;

  const owned = await loadOwnedRelease(request, releaseId, { columns: "*", allowAdmin: true });
  if (!owned.ok) return owned.response;
  const { admin } = owned.value;
  const row: Record<string, unknown> = { ...owned.value.row };
  if (row.status === "processing") {
    row.submitted_at = (await loadSubmittedAt(admin, [releaseId])).get(releaseId) ?? null;
  }

  const withTracks = request.nextUrl.searchParams.get("tracks") === "1";
  if (!withTracks) {
    return NextResponse.json({ ok: true, record: row });
  }

  const { data: tracks, error } = await admin
    .from("tracks")
    .select(RELEASE_TRACKS_SELECT)
    .eq("release_id", releaseId)
    .order("index", { ascending: true });
  if (error) {
    console.error("[releases/:id GET] tracks:", error.message);
    return jsonError(500, "Не удалось загрузить треки.");
  }

  return NextResponse.json({ ok: true, record: row, tracks: tracks ?? [] });
}

export const GET = handleGetOwnRelease;
