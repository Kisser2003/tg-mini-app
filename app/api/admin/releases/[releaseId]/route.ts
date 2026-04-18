import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminSupabaseClient } from "@/lib/admin-release-api-guard";
import type { TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases.repo";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  releaseId: z.string().uuid()
});

async function handleGetAdminRelease(
  _request: NextRequest,
  ctx: TelegramAuthContext,
  routeContext: { params: { releaseId: string } }
): Promise<Response> {
  const guard = requireAdminSupabaseClient(ctx);
  if (!guard.ok) return guard.response;

  const parsed = paramsSchema.safeParse(routeContext.params);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Некорректный ID релиза." }, { status: 400 });
  }

  const { releaseId } = parsed.data;

  const { data: release, error: relErr } = await guard.supabase
    .from("releases")
    .select("*")
    .eq("id", releaseId)
    .maybeSingle();

  if (relErr) {
    console.error("[admin/releases GET] load:", relErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить релиз." }, { status: 500 });
  }

  if (!release) {
    return NextResponse.json({ ok: false, error: "Релиз не найден." }, { status: 404 });
  }

  const { data: tracks, error: trErr } = await guard.supabase
    .from("tracks")
    .select("id, release_id, user_id, index, position, title, explicit, file_path, duration")
    .eq("release_id", releaseId)
    .order("index", { ascending: true });

  if (trErr) {
    console.error("[admin/releases GET] tracks:", trErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить треки." }, { status: 500 });
  }

  const body: {
    ok: true;
    release: ReleaseRecord;
    tracks: ReleaseTrackRow[];
  } = {
    ok: true,
    release: release as ReleaseRecord,
    tracks: (tracks ?? []) as ReleaseTrackRow[]
  };

  return NextResponse.json(body);
}

export async function GET(
  request: NextRequest,
  routeContext: { params: { releaseId: string } }
): Promise<Response> {
  const run = withTelegramAuth((req, ctx) => handleGetAdminRelease(req, ctx, routeContext));
  return run(request);
}
