import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminSupabaseClient } from "@/lib/admin-release-api-guard";
import { getTelegramAuthContextFromRequest } from "@/lib/api/with-telegram-auth";
import { getReleaseDisplayTitle, type ReleaseRecord } from "@/repositories/releases.repo";
import { escapeHtml } from "@/lib/telegram-bot.server";
import { sendTelegramNotification } from "@/lib/telegram-notifications";

const bodySchema = z.object({
  releaseId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  comment: z.string().optional()
});

async function notifyArtistOnModerationResult(
  record: ReleaseRecord,
  action: "approve" | "reject",
  comment?: string
): Promise<void> {
  const tid =
    record.telegram_id != null && String(record.telegram_id).trim() !== ""
      ? String(record.telegram_id)
      : null;
  if (!tid) return;

  const titleRaw = getReleaseDisplayTitle(record);
  const title = escapeHtml(titleRaw.length > 0 ? titleRaw : "релиз");

  if (action === "approve") {
    await sendTelegramNotification(
      tid,
      `✅ <b>Релиз «${title}» одобрен модерацией!</b>\n\nОн принят в дистрибуцию.`
    );
    return;
  }

  const reason = escapeHtml((comment && comment.trim()) || "Отклонено модератором");
  await sendTelegramNotification(
    tid,
    `❌ <b>Релиз «${title}» отклонён модерацией.</b>\n\nПричина: ${reason}`
  );
}

async function handleUpdateReleaseStatus(
  request: NextRequest
): Promise<Response> {
  const guard = await requireAdminSupabaseClient(
    request,
    getTelegramAuthContextFromRequest(request)
  );
  if (!guard.ok) return guard.response;
  const supabase = guard.supabase;

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
  if (status !== "processing") {
    return NextResponse.json(
      { ok: false, error: "Релиз не в очереди модерации (ожидался статус processing)." },
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
    await notifyArtistOnModerationResult(updated as ReleaseRecord, "approve");
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

  await notifyArtistOnModerationResult(updated as ReleaseRecord, "reject", msg);
  return NextResponse.json({ ok: true, record: updated as ReleaseRecord });
}

export const POST = handleUpdateReleaseStatus;
