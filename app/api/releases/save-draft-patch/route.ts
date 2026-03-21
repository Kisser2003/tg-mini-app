import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { formatErrorMessage } from "@/lib/errors";

const bodySchema = z.object({
  releaseId: z.string().uuid(),
  /** Поля как в saveDraftAction `finalData` (частичный update). */
  patch: z.record(z.string(), z.unknown())
});

async function handleSaveDraftPatch(
  request: NextRequest,
  ctx: TelegramAuthContext
): Promise<Response> {
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

  const { releaseId, patch } = parsed.data;
  const telegramUserId = ctx.user.id;

  const { data: row, error: loadErr } = await admin
    .from("releases")
    .select("id, user_id")
    .eq("id", releaseId)
    .maybeSingle();

  if (loadErr) {
    console.error("[save-draft-patch] load:", loadErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить релиз." }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ ok: false, error: "Релиз не найден." }, { status: 404 });
  }

  const ownerId = Number(row.user_id);
  if (!Number.isFinite(ownerId) || ownerId !== telegramUserId) {
    return NextResponse.json({ ok: false, error: "Нет доступа к этому релизу." }, { status: 403 });
  }

  const { data: updated, error: upErr } = await admin
    .from("releases")
    .update(patch as Record<string, unknown>)
    .eq("id", releaseId)
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
    return NextResponse.json({ ok: false, error: "Обновление не применилось." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, record: rows[0] });
}

export const POST = withTelegramAuth(handleSaveDraftPatch);
