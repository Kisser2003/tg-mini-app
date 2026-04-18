import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getTelegramAuthContextFromRequest } from "@/lib/api/with-telegram-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getSupabaseAuthUserIdFromCookies } from "@/lib/supabase-cookies-server";
import { STORAGE_BUCKET_RELEASE_TRACKS } from "@/lib/storage-buckets";
import { getReleaseTrackAudioPartPath, getReleaseTrackAudioPath } from "@/lib/storagePaths";

const bodySchema = z.object({
  releaseId: z.string().uuid(),
  trackIndex: z.number().int().min(0),
  partCount: z.number().int().min(1).max(32)
});

/** ~200 MiB WAV (8 MiB × 25 частей + запас). Vercel: держим в пределах лимита памяти функции. */
const MAX_STITCH_BYTES = 210 * 1024 * 1024;

/**
 * Числовой сегмент путей Storage: Telegram id или синтетический id веб-пользователя.
 * Telegram — из initData; веб — только если cookie-сессия совпадает с `releases.user_uuid`.
 */
async function resolveStitchStorageUserId(
  request: NextRequest,
  releaseId: string
): Promise<number | null> {
  const tgCtx = getTelegramAuthContextFromRequest(request);
  if (tgCtx) {
    return Math.trunc(tgCtx.user.id);
  }

  const authUserId = await getSupabaseAuthUserIdFromCookies();
  if (!authUserId) return null;

  const admin = createSupabaseAdmin();
  if (!admin) return null;

  const { data: row, error } = await admin
    .from("releases")
    .select("user_id, user_uuid")
    .eq("id", releaseId)
    .maybeSingle();

  if (error || !row) return null;
  if (row.user_uuid !== authUserId) return null;

  const raw = row.user_id as unknown;
  const n =
    typeof raw === "bigint" ? Number(raw) : typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

async function runStitch(
  tg: number,
  releaseId: string,
  trackIndex: number,
  partCount: number
): Promise<Response> {
  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 503 });
  }

  const bucket = STORAGE_BUCKET_RELEASE_TRACKS;
  const partPaths: string[] = [];
  const buffers: Buffer[] = [];
  let total = 0;

  for (let i = 0; i < partCount; i++) {
    const path = getReleaseTrackAudioPartPath(tg, releaseId, trackIndex, i);
    partPaths.push(path);
    const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(path);
    if (dlErr || !blob) {
      return NextResponse.json(
        { ok: false, error: `Не удалось скачать часть ${i}: ${dlErr?.message ?? "unknown"}` },
        { status: 400 }
      );
    }
    const ab = await blob.arrayBuffer();
    const buf = Buffer.from(ab);
    total += buf.length;
    if (total > MAX_STITCH_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Суммарный размер частей превышает лимит сборки на сервере." },
        { status: 413 }
      );
    }
    buffers.push(buf);
  }

  const merged = Buffer.concat(buffers);
  const finalPath = getReleaseTrackAudioPath(tg, releaseId, trackIndex);
  const { error: upErr } = await admin.storage.from(bucket).upload(finalPath, merged, {
    upsert: true,
    contentType: "audio/wav",
    cacheControl: "3600"
  });

  if (upErr) {
    console.error("[stitch-track-parts] upload final:", upErr.message);
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  await admin.storage.from(bucket).remove(partPaths);

  const {
    data: { publicUrl }
  } = admin.storage.from(bucket).getPublicUrl(finalPath);

  return NextResponse.json({ ok: true, publicUrl });
}

export async function POST(request: NextRequest): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const { releaseId, trackIndex, partCount } = parsed.data;

  const tg = await resolveStitchStorageUserId(request, releaseId);
  if (tg == null) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return runStitch(tg, releaseId, trackIndex, partCount);
}
