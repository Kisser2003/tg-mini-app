import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveReleaseActor } from "@/lib/api/resolve-submit-actor";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { formatErrorMessage } from "@/lib/errors";
import { isReleaseActorOwner } from "@/lib/release-ownership.server";
import { mergeFormCollaboratorsWithExistingDb } from "@/lib/collaborators";
import { isOwnerEditableStatus } from "@/lib/api/release-owner-route";
import { invalidateMyReleasesCache } from "@/lib/server/release-list-cache";
import { RELEASE_TYPE_VALUES } from "@/lib/db-enums";

/**
 * Что владелец может править в своём черновике. Идентичность (`user_id`, `telegram_id`, `user_uuid`,
 * `client_request_id`), модерация (`admin_notes`, `upc`, `smart_link`, …) и любые другие колонки — нет.
 */
const patchSchema = z
  .object({
    artist_name: z.string().trim().max(256),
    title: z.string().trim().max(256),
    release_type: z.enum(RELEASE_TYPE_VALUES),
    genre: z.string().trim().max(128),
    release_date: z.string().max(32),
    explicit: z.boolean(),
    collaborators: z.unknown(),
    artwork_url: z.string().url().max(2048).nullable(),
    lyrics: z.string().max(200_000).nullable(),
    isrc: z.string().trim().max(15).nullable(),
    artist_links: z.record(z.string(), z.unknown()).nullable(),
    performance_language: z.string().trim().max(16).nullable(),
    /** Владелец может только вернуть релиз в работу; на модерацию — через finalize-submit. */
    status: z.enum(["draft", "pending"]),
    /** Только сброс текста ошибки при повторной отправке. */
    error_message: z.null()
  })
  .partial()
  .strict();

const bodySchema = z.object({
  releaseId: z.string().uuid(),
  /** Поля как в saveDraftAction `finalData` (частичный update). */
  patch: z.record(z.string(), z.unknown())
});

async function handleSaveDraftPatch(request: NextRequest): Promise<Response> {
  const actor = await resolveReleaseActor(request);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
      { status: 503 }
    );
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

  const { releaseId } = parsed.data;
  const patchParsed = patchSchema.safeParse(parsed.data.patch);
  if (!patchParsed.success) {
    return NextResponse.json(
      { ok: false, error: "Недопустимые поля в изменениях черновика." },
      { status: 400 }
    );
  }
  const patch = patchParsed.data;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "Нет изменений." }, { status: 400 });
  }

  const { data: row, error: loadErr } = await admin
    .from("releases")
    .select("id, user_id, telegram_id, user_uuid, status, collaborators")
    .eq("id", releaseId)
    .maybeSingle();

  if (loadErr) {
    console.error("[save-draft-patch] load:", loadErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить релиз." }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ ok: false, error: "Релиз не найден." }, { status: 404 });
  }

  const rowObj = row as Record<string, unknown>;
  if (!(await isReleaseActorOwner(admin, rowObj, actor))) {
    return NextResponse.json({ ok: false, error: "Нет доступа к этому релизу." }, { status: 403 });
  }

  if (!isOwnerEditableStatus(rowObj.status)) {
    return NextResponse.json(
      { ok: false, error: "Релиз уже отправлен на проверку — изменения недоступны." },
      { status: 409 }
    );
  }

  const patchObj = patch as Record<string, unknown>;
  let updatePayload: Record<string, unknown> = patchObj;
  if (Object.prototype.hasOwnProperty.call(patchObj, "collaborators")) {
    updatePayload = {
      ...patchObj,
      collaborators: mergeFormCollaboratorsWithExistingDb(
        patchObj.collaborators,
        rowObj.collaborators
      )
    };
  }

  const { data: updated, error: upErr } = await admin
    .from("releases")
    .update(updatePayload)
    .eq("id", releaseId)
    .in("status", ["draft", "pending", "failed"])
    .select("*");

  if (upErr) {
    console.error("[save-draft-patch] update:", upErr.message);
    return NextResponse.json(
      { ok: false, error: formatErrorMessage(upErr, "Не удалось сохранить черновик.") },
      { status: 500 }
    );
  }

  const rows = updated as unknown[] | null;
  if (!rows || rows.length === 0) {
    // Статус сменился между чтением и записью (ушёл на модерацию).
    return NextResponse.json(
      { ok: false, error: "Релиз уже отправлен на проверку — изменения недоступны." },
      { status: 409 }
    );
  }

  if ("status" in patchObj) {
    await invalidateMyReleasesCache(rowObj);
  }

  return NextResponse.json({ ok: true, record: rows[0] });
}

export const POST = handleSaveDraftPatch;
