import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { MAX_WAV_MB } from "@/lib/storage-buckets";
import { resolveReleaseActor } from "@/lib/api/resolve-submit-actor";
import { isReleaseActorOwner } from "@/lib/release-ownership.server";
import { createS3UploadUrls, getS3Config } from "@/lib/s3-config.server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getReleaseTrackAudioPath } from "@/lib/storagePaths";

export const runtime = "nodejs";

const bodySchema = z.object({
  releaseId: z.string().uuid(),
  trackIndex: z.number().int().min(0).max(99),
  /** Размер файла в байтах: входит в подпись ссылки, поэтому больше заявленного залить нельзя. */
  sizeBytes: z.number().int().positive()
});

/**
 * Выдаёт ссылку для прямой загрузки WAV из браузера в S3-совместимое хранилище.
 * Файл не проходит через Vercel. Ключ объекта строится на сервере из проверенного владельца релиза.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const actor = await resolveReleaseActor(request);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const cfg = getS3Config();
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: "Внешнее хранилище аудио не настроено." },
      { status: 503 }
    );
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Некорректное тело запроса." }, { status: 400 });
  }
  const { releaseId, trackIndex, sizeBytes } = parsed.data;
  if (sizeBytes > MAX_WAV_MB * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, error: `Файл больше ${MAX_WAV_MB} МБ. Выбери файл поменьше.` },
      { status: 413 }
    );
  }

  const { data: row, error } = await admin
    .from("releases")
    .select("id, user_id, telegram_id, user_uuid, status")
    .eq("id", releaseId)
    .maybeSingle();
  if (error || !row) {
    return NextResponse.json({ ok: false, error: "Релиз не найден." }, { status: 404 });
  }
  if (!(await isReleaseActorOwner(admin, row as Record<string, unknown>, actor))) {
    return NextResponse.json({ ok: false, error: "Нет доступа к этому релизу." }, { status: 403 });
  }
  const status = String(row.status ?? "");
  if (status !== "draft" && status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "Файлы можно менять только у черновика." },
      { status: 409 }
    );
  }

  const ownerSegment = Number(row.user_id ?? row.telegram_id);
  if (!Number.isFinite(ownerSegment) || ownerSegment <= 0) {
    return NextResponse.json({ ok: false, error: "Не удалось определить владельца." }, { status: 400 });
  }

  const objectKey = getReleaseTrackAudioPath(Math.trunc(ownerSegment), releaseId, trackIndex);
  const { uploadUrl, publicUrl } = createS3UploadUrls(cfg, objectKey, sizeBytes);
  return NextResponse.json({ ok: true, uploadUrl, publicUrl });
}
