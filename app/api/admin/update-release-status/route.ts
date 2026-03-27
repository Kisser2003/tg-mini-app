import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import { getExpectedAdminTelegramId, telegramIdsEqual } from "@/lib/admin";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { ReleaseRecord } from "@/repositories/releases.repo";

const bodySchema = z.object({
  releaseId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  comment: z.string().optional()
});

async function handleUpdateReleaseStatus(
  request: NextRequest,
  ctx: TelegramAuthContext
): Promise<Response> {
  const adminId = getExpectedAdminTelegramId();
  if (!telegramIdsEqual(ctx.user.id, adminId)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseAdmin();
  if (!supabase) {
    console.error("[admin/update-release-status] missing Supabase service role");
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

  const { releaseId, action, comment } = parsed.data;

  const { data: row, error: loadErr } = await supabase
    .from("releases")
    .select("*")
    .eq("id", releaseId)
    .maybeSingle();

  if (loadErr) {
    console.error("[admin/update-release-status] load:", loadErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить релиз." }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ ok: false, error: "Релиз не найден." }, { status: 404 });
  }

  const status = row.status as string;
  if (status !== "processing" && status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "Релиз не в очереди модерации (ожидались статусы processing или pending)." },
      { status: 409 }
    );
  }

  // Одобрение: только смена статуса релиза. Кошелёк/транзакции (ledger) намеренно не трогаем — фича заморожена.
  if (action === "approve") {
    const { data: updated, error: updErr } = await supabase
      .from("releases")
      .update({
        status: "ready",
        error_message: null
      })
      .eq("id", releaseId)
      .select("*")
      .maybeSingle();

    if (updErr) {
      console.error("[admin/update-release-status] approve:", updErr.message);
      return NextResponse.json({ ok: false, error: "Не удалось одобрить релиз." }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Не удалось обновить релиз." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, record: updated as ReleaseRecord });
  }

  const msg = (comment && comment.trim()) || "Отклонено модератором";

  const { data: updated, error: updErr } = await supabase
    .from("releases")
    .update({
      status: "failed",
      error_message: msg
    })
    .eq("id", releaseId)
    .select("*")
    .maybeSingle();

  if (updErr) {
    console.error("[admin/update-release-status] reject:", updErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось отклонить релиз." }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ ok: false, error: "Не удалось обновить релиз." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, record: updated as ReleaseRecord });
}

export const POST = withTelegramAuth(handleUpdateReleaseStatus);
