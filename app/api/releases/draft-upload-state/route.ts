import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  releaseId: z.string().uuid(),
  phase: z.enum(["start", "complete", "failed"])
});

async function handleDraftUploadState(
  request: NextRequest,
  ctx: TelegramAuthContext
): Promise<Response> {
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
  const telegramUserId = ctx.user.id;

  const { data: row, error: loadErr } = await admin
    .from("releases")
    .select("id, user_id, status")
    .eq("id", releaseId)
    .maybeSingle();

  if (loadErr) {
    console.error("[releases/draft-upload-state] load:", loadErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить релиз." }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ ok: false, error: "Релиз не найден." }, { status: 404 });
  }

  const ownerId = Number(row.user_id);
  if (!Number.isFinite(ownerId) || ownerId !== telegramUserId) {
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
      .eq("user_id", telegramUserId)
      .in("status", ["draft", "pending"]);

    if (error) {
      console.error("[releases/draft-upload-state] start:", error.message);
      return NextResponse.json({ ok: false, error: "Не удалось обновить статус." }, { status: 500 });
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
      .eq("user_id", telegramUserId)
      .in("status", ["draft", "pending"]);

    if (error) {
      console.error("[releases/draft-upload-state] complete:", error.message);
      return NextResponse.json({ ok: false, error: "Не удалось обновить статус." }, { status: 500 });
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
    .eq("user_id", telegramUserId)
    .in("status", ["draft", "pending"]);

  if (error) {
    console.error("[releases/draft-upload-state] failed:", error.message);
    return NextResponse.json({ ok: false, error: "Не удалось сбросить статус." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withTelegramAuth(handleDraftUploadState);
