import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminSupabaseClient } from "@/lib/admin-release-api-guard";
import type { TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import {
  contentDispositionAttachment,
  downloadStorageObjectBytes,
  guessFilenameFromUrl
} from "@/lib/supabase-storage-download";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const paramsSchema = z.object({
  releaseId: z.string().uuid()
});

async function handleDownload(
  request: NextRequest,
  ctx: TelegramAuthContext,
  context: { params: { releaseId: string } }
): Promise<Response> {
  const guard = requireAdminSupabaseClient(ctx);
  if (!guard.ok) return guard.response;

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: "Некорректный ID релиза." }, { status: 400 });
  }

  const { releaseId } = parsedParams.data;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");

  if (kind !== "artwork" && kind !== "audio") {
    return NextResponse.json(
      { ok: false, error: "Укажите kind=artwork или kind=audio." },
      { status: 400 }
    );
  }

  const { data: row, error: loadErr } = await guard.supabase
    .from("releases")
    .select("*")
    .eq("id", releaseId)
    .maybeSingle();

  if (loadErr) {
    console.error("[admin/releases/download] load:", loadErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить релиз." }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ ok: false, error: "Релиз не найден." }, { status: 404 });
  }

  try {
    if (kind === "artwork") {
      const artworkUrl = row.artwork_url as string | null;
      if (!artworkUrl?.trim()) {
        return NextResponse.json({ ok: false, error: "Обложка не загружена." }, { status: 404 });
      }
      const { data, contentType } = await downloadStorageObjectBytes(guard.supabase, artworkUrl.trim());
      const filename = guessFilenameFromUrl(artworkUrl, `cover-${releaseId}`);
      return new NextResponse(data, {
        headers: {
          "Content-Type": contentType ?? "application/octet-stream",
          "Content-Disposition": contentDispositionAttachment(filename),
          "Cache-Control": "no-store"
        }
      });
    }

    const trackId = url.searchParams.get("trackId")?.trim() ?? "";
    const trackIndexRaw = url.searchParams.get("trackIndex");

    let audioUrl: string | null = null;
    let filenameBase = `release-${releaseId}`;

    if (trackId.length > 0) {
      const { data: tr, error: trErr } = await guard.supabase
        .from("tracks")
        .select("id, file_path, index, release_id")
        .eq("id", trackId)
        .maybeSingle();

      if (trErr) {
        console.error("[admin/releases/download] track:", trErr.message);
        return NextResponse.json({ ok: false, error: "Не удалось загрузить трек." }, { status: 500 });
      }
      if (!tr || String(tr.release_id) !== releaseId) {
        return NextResponse.json({ ok: false, error: "Трек не найден." }, { status: 404 });
      }
      audioUrl = (tr.file_path as string | null)?.trim() ?? null;
      const idx = typeof tr.index === "number" ? tr.index : 0;
      filenameBase = `track-${String(idx + 1).padStart(2, "0")}-${releaseId}`;
    } else if (trackIndexRaw !== null && trackIndexRaw !== "") {
      const idx = Number(trackIndexRaw);
      if (!Number.isFinite(idx) || idx < 0 || !Number.isInteger(idx)) {
        return NextResponse.json({ ok: false, error: "Некорректный trackIndex." }, { status: 400 });
      }
      const { data: tr, error: trErr } = await guard.supabase
        .from("tracks")
        .select("file_path, index")
        .eq("release_id", releaseId)
        .eq("index", idx)
        .maybeSingle();

      if (trErr) {
        console.error("[admin/releases/download] track by index:", trErr.message);
        return NextResponse.json({ ok: false, error: "Не удалось загрузить трек." }, { status: 500 });
      }
      audioUrl = (tr?.file_path as string | null)?.trim() ?? null;
      filenameBase = `track-${String(idx + 1).padStart(2, "0")}-${releaseId}`;
    } else {
      audioUrl = (row.audio_url as string | null)?.trim() ?? null;
      filenameBase = `master-${releaseId}`;
    }

    if (!audioUrl) {
      return NextResponse.json({ ok: false, error: "Аудиофайл не найден." }, { status: 404 });
    }

    const { data, contentType } = await downloadStorageObjectBytes(guard.supabase, audioUrl);
    const filename = guessFilenameFromUrl(audioUrl, filenameBase);

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType ?? "application/octet-stream",
        "Content-Disposition": contentDispositionAttachment(filename),
        "Cache-Control": "no-store"
      }
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Download failed";
    console.error("[admin/releases/download]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}

export async function GET(
  request: NextRequest,
  routeContext: { params: { releaseId: string } }
): Promise<Response> {
  const run = withTelegramAuth((req, ctx) => handleDownload(req, ctx, routeContext));
  return run(request);
}
