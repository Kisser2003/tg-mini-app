import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminSupabaseClient } from "@/lib/admin-release-api-guard";
import { getTelegramAuthContextFromRequest } from "@/lib/api/with-telegram-auth";
import { deleteAllReleaseFiles } from "@/lib/release-audio-cleanup.server";
import { invalidateMyReleasesCache } from "@/lib/server/release-list-cache";
import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases.repo";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  releaseId: z.string().uuid()
});

async function handleGetAdminRelease(
  request: NextRequest,
  routeContext: { params: { releaseId: string } }
): Promise<Response> {
  const guard = await requireAdminSupabaseClient(
    request,
    getTelegramAuthContextFromRequest(request)
  );
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
    .select("id, release_id, user_id, index, position, title, explicit, file_path, lyrics, duration")
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
  return handleGetAdminRelease(request, routeContext);
}

/**
 * Удалить релиз целиком (тестовые, дубли). Треки, логи и AI-проверки уходят каскадом по FK,
 * файлы чистим после — best effort. Артисту ничего не пишем. Необратимо.
 */
async function handleDeleteAdminRelease(
  request: NextRequest,
  routeContext: { params: { releaseId: string } }
): Promise<Response> {
  const guard = await requireAdminSupabaseClient(
    request,
    getTelegramAuthContextFromRequest(request)
  );
  if (!guard.ok) return guard.response;

  const parsed = paramsSchema.safeParse(routeContext.params);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Некорректный ID релиза." }, { status: 400 });
  }

  const { releaseId } = parsed.data;

  const { data: release, error: relErr } = await guard.supabase
    .from("releases")
    .select("id, status, artwork_url, audio_url, telegram_id, user_id, user_uuid")
    .eq("id", releaseId)
    .maybeSingle();

  if (relErr) {
    console.error("[admin/releases DELETE] load:", relErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить релиз." }, { status: 500 });
  }

  if (!release) {
    return NextResponse.json({ ok: false, error: "Релиз не найден." }, { status: 404 });
  }

  // Ссылки на файлы треков — до удаления: строки tracks уйдут каскадом вместе с релизом.
  const { data: tracks, error: trErr } = await guard.supabase
    .from("tracks")
    .select("file_path")
    .eq("release_id", releaseId);

  if (trErr) {
    console.error("[admin/releases DELETE] tracks:", trErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить треки." }, { status: 500 });
  }

  const { error: delErr } = await guard.supabase.from("releases").delete().eq("id", releaseId);

  if (delErr) {
    console.error("[admin/releases DELETE] delete:", delErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось удалить релиз." }, { status: 500 });
  }

  const row = release as { id: string; status: string; artwork_url: string | null; audio_url: string | null };
  await deleteAllReleaseFiles(
    guard.supabase,
    row,
    (tracks ?? []).map((t) => String((t as { file_path?: string | null }).file_path ?? ""))
  );
  // Иначе у артиста до 20 с висит удалённый релиз в «Моих релизах».
  await invalidateMyReleasesCache(release as Record<string, unknown>);
  console.info("[admin/releases DELETE] deleted", releaseId, "status:", row.status);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  routeContext: { params: { releaseId: string } }
): Promise<Response> {
  return handleDeleteAdminRelease(request, routeContext);
}
