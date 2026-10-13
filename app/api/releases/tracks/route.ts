import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  jsonError,
  loadOwnedRelease,
  readJsonBody,
  rejectIfLocked
} from "@/lib/api/release-owner-route";
import { formatErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

const upsertSchema = z.object({
  releaseId: z.string().uuid(),
  index: z.number().int().min(0).max(99),
  title: z.string().trim().min(1).max(256),
  explicit: z.boolean(),
  /** Публичный URL после загрузки в Storage — колонка `file_path`. */
  audioUrl: z.string().url().max(2048),
  lyrics: z.string().max(32000).nullable().optional()
});

const deleteSchema = z.object({ releaseId: z.string().uuid() });

/** Upsert строки трека (`release_id, index`). Владелец строки = владелец релиза. */
async function handleUpsertTrack(request: NextRequest): Promise<Response> {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = upsertSchema.safeParse(body.value);
  if (!parsed.success) {
    return jsonError(400, "Некорректное тело запроса.");
  }
  const input = parsed.data;

  const owned = await loadOwnedRelease(request, input.releaseId);
  if (!owned.ok) return owned.response;
  const { admin, row } = owned.value;
  const locked = rejectIfLocked(row);
  if (locked) return locked;

  const lyrics = input.lyrics == null || input.lyrics.trim() === "" ? null : input.lyrics.trim();
  const ownerUserId = Number(row.user_id);

  const { error } = await admin.from("tracks").upsert(
    {
      release_id: input.releaseId,
      user_id: Number.isFinite(ownerUserId) && ownerUserId > 0 ? Math.trunc(ownerUserId) : null,
      telegram_id: row.telegram_id == null ? null : String(row.telegram_id),
      user_uuid: typeof row.user_uuid === "string" && row.user_uuid ? row.user_uuid : null,
      index: input.index,
      title: input.title,
      explicit: input.explicit,
      file_path: input.audioUrl,
      lyrics
    },
    { onConflict: "release_id,index" }
  );
  if (error) {
    console.error("[releases/tracks POST] upsert:", error.message);
    return jsonError(500, formatErrorMessage(error, "Не удалось сохранить трек."));
  }

  return NextResponse.json({ ok: true });
}

/** Удалить все треки релиза (откат неудачной отправки). */
async function handleDeleteTracks(request: NextRequest): Promise<Response> {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = deleteSchema.safeParse(body.value);
  if (!parsed.success) {
    return jsonError(400, "Некорректное тело запроса.");
  }

  const owned = await loadOwnedRelease(request, parsed.data.releaseId);
  if (!owned.ok) return owned.response;
  const { admin, row } = owned.value;
  const locked = rejectIfLocked(row);
  if (locked) return locked;

  const { error } = await admin.from("tracks").delete().eq("release_id", parsed.data.releaseId);
  if (error) {
    console.error("[releases/tracks DELETE]:", error.message);
    return jsonError(500, "Не удалось удалить треки.");
  }

  return NextResponse.json({ ok: true });
}

export const POST = handleUpsertTrack;
export const DELETE = handleDeleteTracks;
