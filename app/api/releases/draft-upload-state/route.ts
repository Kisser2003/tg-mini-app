import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveReleaseActor } from "@/lib/api/resolve-submit-actor";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  formatErrorMessage,
  isMissingReleasesColumnError,
  logSupabaseUpdateError
} from "@/lib/errors";
import { isReleaseActorOwner } from "@/lib/release-ownership.server";

const bodySchema = z.object({
  releaseId: z.string().uuid(),
  phase: z.enum(["start", "complete", "failed"])
});

async function handleDraftUploadState(request: NextRequest): Promise<Response> {
  const actor = await resolveReleaseActor(request);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    console.error("[releases/draft-upload-state] missing Supabase admin");
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

  const { releaseId, phase } = parsed.data;

  const { data: row, error: loadErr } = await admin
    .from("releases")
    .select("id, user_id, telegram_id, user_uuid, status")
    .eq("id", releaseId)
    .maybeSingle();

  if (loadErr) {
    logSupabaseUpdateError("releases/draft-upload-state load", loadErr);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить релиз." }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ ok: false, error: "Релиз не найден." }, { status: 404 });
  }

  if (!(await isReleaseActorOwner(admin, row as Record<string, unknown>, actor))) {
    return NextResponse.json({ ok: false, error: "Нет доступа к этому релизу." }, { status: 403 });
  }

  const status = String(row.status ?? "");

  if (phase === "start") {
    if (status !== "draft" && status !== "pending") {
      return NextResponse.json(
        { ok: false, error: "Начать загрузку можно только для черновика." },
        { status: 409 }
      );
    }
    const { error } = await admin
      .from("releases")
      .update({ draft_upload_started: true })
      .eq("id", releaseId)
      .in("status", ["draft", "pending"]);

    if (error) {
      logSupabaseUpdateError("releases/draft-upload-state start", error);
      if (isMissingReleasesColumnError(error, "draft_upload_started")) {
        console.warn(
          "[releases/draft-upload-state] start: колонка draft_upload_started отсутствует в БД — пропускаем флаг (примените миграцию 20260325120000_release_pending_admin_notes.sql)."
        );
        return NextResponse.json({ ok: true, degraded: true });
      }
      return NextResponse.json(
        {
          ok: false,
          error: formatErrorMessage(error, "Не удалось обновить статус.")
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (phase === "complete") {
    if (status !== "draft" && status !== "pending") {
      return NextResponse.json(
        { ok: false, error: "Некорректный статус для завершения загрузки." },
        { status: 409 }
      );
    }
    const { error } = await admin
      .from("releases")
      .update({
        draft_upload_started: false,
        status: "pending"
      })
      .eq("id", releaseId)
      .in("status", ["draft", "pending"]);

    if (error) {
      logSupabaseUpdateError("releases/draft-upload-state complete", error);
      if (isMissingReleasesColumnError(error, "draft_upload_started")) {
        const { error: err2 } = await admin
          .from("releases")
          .update({ status: "pending" })
          .eq("id", releaseId)
          .in("status", ["draft", "pending"]);
        if (err2) {
          logSupabaseUpdateError("releases/draft-upload-state complete (fallback status only)", err2);
          return NextResponse.json(
            { ok: false, error: formatErrorMessage(err2, "Не удалось обновить статус.") },
            { status: 500 }
          );
        }
        console.warn(
          "[releases/draft-upload-state] complete: без draft_upload_started — обновлён только status=pending."
        );
        return NextResponse.json({ ok: true, degraded: true });
      }
      return NextResponse.json(
        { ok: false, error: formatErrorMessage(error, "Не удалось обновить статус.") },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  // failed
  const { error } = await admin
    .from("releases")
    .update({
      draft_upload_started: false,
      status: "draft"
    })
    .eq("id", releaseId)
    .in("status", ["draft", "pending"]);

  if (error) {
    logSupabaseUpdateError("releases/draft-upload-state failed", error);
    if (isMissingReleasesColumnError(error, "draft_upload_started")) {
      const { error: err2 } = await admin
        .from("releases")
        .update({ status: "draft" })
        .eq("id", releaseId)
        .in("status", ["draft", "pending"]);
      if (err2) {
        logSupabaseUpdateError("releases/draft-upload-state failed (fallback status only)", err2);
        return NextResponse.json(
          { ok: false, error: formatErrorMessage(err2, "Не удалось сбросить статус.") },
          { status: 500 }
        );
      }
      console.warn(
        "[releases/draft-upload-state] failed: без draft_upload_started — обновлён только status=draft."
      );
      return NextResponse.json({ ok: true, degraded: true });
    }
    return NextResponse.json(
      { ok: false, error: formatErrorMessage(error, "Не удалось сбросить статус.") },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export const POST = handleDraftUploadState;
