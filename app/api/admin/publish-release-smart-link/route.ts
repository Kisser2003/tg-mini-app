import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminSupabaseClient } from "@/lib/admin-release-api-guard";
import { getTelegramAuthContextFromRequest } from "@/lib/api/with-telegram-auth";
import { assertHttpsUrl, mapAdminPublishStatusToDb } from "@/lib/admin-release-publish";
import { getReleaseDisplayTitle, type ReleaseRecord } from "@/repositories/releases.repo";
import { escapeHtml } from "@/lib/telegram-bot.server";
import { sendTelegramNotification } from "@/lib/telegram-notifications";

const bodySchema = z.object({
  releaseId: z.string().uuid(),
  newStatus: z.string().min(1),
  smartLink: z.string().min(1).max(2048)
});

async function notifyArtistSmartLink(record: ReleaseRecord, smartLink: string): Promise<void> {
  const tid =
    record.telegram_id != null && String(record.telegram_id).trim() !== ""
      ? String(record.telegram_id)
      : null;
  if (!tid) return;

  const titleRaw = getReleaseDisplayTitle(record);
  const title = escapeHtml(titleRaw.length > 0 ? titleRaw : "релиз");
  const linkEsc = escapeHtml(smartLink);

  await sendTelegramNotification(
    tid,
    `✅ <b>Релиз «${title}» вышел!</b>\n\n🔗 <a href="${linkEsc}">Слушать / Smart Link</a>`
  );
}

async function handlePublishReleaseSmartLink(request: NextRequest): Promise<Response> {
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

  let dbStatus: ReturnType<typeof mapAdminPublishStatusToDb>;
  let normalizedUrl: string;
  try {
    dbStatus = mapAdminPublishStatusToDb(parsed.data.newStatus);
    normalizedUrl = assertHttpsUrl(parsed.data.smartLink);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Некорректные данные.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  if (dbStatus !== "ready") {
    return NextResponse.json(
      { ok: false, error: "Для выпуска со smart link статус должен быть RELEASED/ready." },
      { status: 400 }
    );
  }

  const { releaseId } = parsed.data;

  const { data: row, error: loadErr } = await supabase
    .from("releases")
    .select("*")
    .eq("id", releaseId)
    .maybeSingle();

  if (loadErr) {
    console.error("[admin/publish-release-smart-link] load:", loadErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить релиз." }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ ok: false, error: "Релиз не найден." }, { status: 404 });
  }

  const status = String(row.status ?? "").toLowerCase();
  if (status !== "processing" && status !== "review") {
    return NextResponse.json(
      {
        ok: false,
        error: "Релиз не в очереди модерации (нужен статус «на проверке»: processing или review)."
      },
      { status: 409 }
    );
  }

  const { data: updated, error: updErr } = await supabase
    .from("releases")
    .update({
      status: "ready",
      smart_link: normalizedUrl,
      error_message: null
    })
    .eq("id", releaseId)
    .select("*")
    .maybeSingle();

  if (updErr) {
    const detail = [updErr.message, (updErr as { details?: string }).details]
      .filter(Boolean)
      .join(" — ");
    console.error("[admin/publish-release-smart-link] update:", detail, updErr);
    return NextResponse.json(
      {
        ok: false,
        error: "Не удалось сохранить выпуск.",
        detail: detail || undefined
      },
      { status: 500 }
    );
  }

  if (!updated) {
    return NextResponse.json({ ok: false, error: "Обновление не применилось." }, { status: 500 });
  }

  const rec = updated as ReleaseRecord;
  await notifyArtistSmartLink(rec, normalizedUrl);
  return NextResponse.json({ ok: true, record: rec });
}

export const POST = handlePublishReleaseSmartLink;
