import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { resolveReleaseActor } from "@/lib/api/resolve-submit-actor";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { isReleaseActorOwner } from "@/lib/release-ownership.server";
import { invalidateMyReleasesCache } from "@/lib/server/release-list-cache";

export const runtime = "nodejs";

const bodySchema = z.object({ releaseId: z.string().uuid() });

/**
 * Вернуть отклонённый релиз (failed) в черновик, чтобы артист исправил замечания
 * и отправил повторно. Файлы остаются в хранилище, замечания модератора сохраняются.
 */
async function handleReopenRejected(request: NextRequest): Promise<Response> {
  const actor = await resolveReleaseActor(request);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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
  const { releaseId } = parsed.data;

  const { data: row, error: loadErr } = await admin
    .from("releases")
    .select("id, user_id, telegram_id, user_uuid, status")
    .eq("id", releaseId)
    .maybeSingle();
  if (loadErr) {
    console.error("[releases/reopen-rejected] load:", loadErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить релиз." }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ ok: false, error: "Релиз не найден." }, { status: 404 });
  }
  if (!(await isReleaseActorOwner(admin, row as Record<string, unknown>, actor))) {
    return NextResponse.json({ ok: false, error: "Нет доступа к этому релизу." }, { status: 403 });
  }

  const status = String(row.status ?? "");
  // Идемпотентно: уже открыт для правок.
  if (status === "draft" || status === "pending") {
    return NextResponse.json({ ok: true, alreadyOpen: true });
  }
  if (status !== "failed") {
    return NextResponse.json(
      { ok: false, error: "Исправить можно только отклонённый релиз." },
      { status: 409 }
    );
  }

  // Статус `pending` = файлы загружены, но submit ещё не нажат — ровно наш случай.
  const { error: updErr } = await admin
    .from("releases")
    .update({ status: "pending", draft_upload_started: false })
    .eq("id", releaseId)
    .eq("status", "failed");
  if (updErr) {
    console.error("[releases/reopen-rejected] update:", updErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось открыть релиз для правок." }, { status: 500 });
  }

  await invalidateMyReleasesCache(row as Record<string, unknown>);
  return NextResponse.json({ ok: true });
}

export const POST = handleReopenRejected;
