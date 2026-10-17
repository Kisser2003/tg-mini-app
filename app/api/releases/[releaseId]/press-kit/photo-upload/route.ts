import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, loadOwnedRelease, readJsonBody } from "@/lib/api/release-owner-route";
import {
  PRESS_PHOTO_MAX_BYTES,
  PRESS_PHOTO_MAX_MB,
  isPitchingOpen,
  isPressPhotoMime,
  pressPhotoExt
} from "@/lib/press-kit";
import { STORAGE_BUCKET_PRESS_PHOTOS } from "@/lib/storage-buckets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const paramsSchema = z.object({ releaseId: z.string().uuid() });
const bodySchema = z.object({
  mime: z.string().max(100),
  size: z.number().int().positive()
});

/**
 * Ссылка на загрузку фото артиста в приватный бакет. Файл идёт из браузера прямо в Storage,
 * мимо Vercel (лимит тела запроса там 4,5 МБ). Размер и тип дополнительно режет сам бакет.
 */
async function handlePost(request: NextRequest, ctx: { params: { releaseId: string } }): Promise<Response> {
  const params = paramsSchema.safeParse(ctx.params);
  if (!params.success) return jsonError(400, "Некорректный ID релиза.");
  const { releaseId } = params.data;

  const owned = await loadOwnedRelease(request, releaseId, {
    columns: "id, user_id, telegram_id, user_uuid, status, smart_link"
  });
  if (!owned.ok) return owned.response;
  const { admin, row } = owned.value;
  if (!isPitchingOpen(row.status as string | null, row.smart_link as string | null)) {
    return jsonError(409, "Питчинг откроется, когда релиз выпустят и появится ссылка.");
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) return jsonError(400, "Некорректный запрос.");
  const { mime, size } = parsed.data;
  if (!isPressPhotoMime(mime)) return jsonError(400, "Нужно фото в JPG, PNG или WEBP.");
  if (size > PRESS_PHOTO_MAX_BYTES) return jsonError(400, `Фото больше ${PRESS_PHOTO_MAX_MB} МБ.`);

  const path = `${releaseId}/${crypto.randomUUID()}.${pressPhotoExt(mime)}`;
  const { data, error } = await admin.storage.from(STORAGE_BUCKET_PRESS_PHOTOS).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[press-kit/photo-upload]:", error?.message);
    return jsonError(500, "Не удалось подготовить загрузку фото.");
  }
  return NextResponse.json({ ok: true, path: data.path, token: data.token, bucket: STORAGE_BUCKET_PRESS_PHOTOS });
}

export const POST = handlePost;
