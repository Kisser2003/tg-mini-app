import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { formatErrorMessage } from "@/lib/errors";
import { escapeHtml } from "@/lib/telegram-bot.server";
import { sendTelegramNotification } from "@/lib/telegram-notifications";
import { getReleaseDisplayTitle, type ReleaseRecord } from "@/repositories/releases.repo";

async function notifyReleaseSubmittedForModeration(
  record: ReleaseRecord,
  telegramUserId: number
): Promise<void> {
  const fromRow =
    record.telegram_id != null && String(record.telegram_id).trim() !== ""
      ? String(record.telegram_id)
      : record.user_id != null && String(record.user_id).trim() !== ""
        ? String(record.user_id)
        : String(telegramUserId);
  const rawTitle = getReleaseDisplayTitle(record);
  const title = escapeHtml(rawTitle.length > 0 ? rawTitle : "релиз");
  const text =
    `🚀 <b>Ваш релиз «${title}» отправлен на модерацию!</b>\n\n` +
    `Мы проверим его в течение 24 часов и пришлем уведомление здесь.`;
  /** Обязательно await — иначе на Vercel serverless ответ уходит до fetch в Telegram API. */
  await sendTelegramNotification(fromRow, text);
}

const bodySchema = z.object({
  releaseId: z.string().uuid(),
  clientRequestId: z.string().uuid()
});

async function handleFinalizeSubmit(
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

  const { releaseId, clientRequestId } = parsed.data;
  const telegramUserId = ctx.user.id;

  const { data: currentRow, error: loadErr } = await admin
    .from("releases")
    .select("*")
    .eq("id", releaseId)
    .maybeSingle();

  if (loadErr) {
    console.error("[finalize-submit] load:", loadErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить релиз." }, { status: 500 });
  }

  if (!currentRow) {
    return NextResponse.json({ ok: false, error: "Релиз не найден." }, { status: 404 });
  }

  const ownerId = Number(currentRow.user_id);
  if (!Number.isFinite(ownerId) || ownerId !== telegramUserId) {
    return NextResponse.json({ ok: false, error: "Нет доступа к этому релизу." }, { status: 403 });
  }

  if (currentRow.client_request_id !== clientRequestId) {
    return NextResponse.json(
      { ok: false, error: "Идентификатор запроса не совпадает с релизом." },
      { status: 400 }
    );
  }

  const current = currentRow as ReleaseRecord;
  if (current.status === "processing" || current.status === "ready") {
    return NextResponse.json({ ok: true, record: current });
  }

  const { data: rpcData, error: rpcError } = await admin.rpc("finalize_release", {
    p_release_id: releaseId,
    p_client_request_id: clientRequestId
  });

  if (!rpcError) {
    const rows = Array.isArray(rpcData) ? rpcData : rpcData ? [rpcData] : [];
    if (rows.length > 0) {
      const rec = rows[0] as ReleaseRecord;
      await notifyReleaseSubmittedForModeration(rec, telegramUserId);
      return NextResponse.json({ ok: true, record: rec });
    }
  } else {
    const isMissing =
      rpcError.message?.includes("could not find") ||
      rpcError.message?.includes("function") ||
      rpcError.code === "PGRST202";
    if (!isMissing) {
      console.error("[finalize-submit] rpc:", rpcError.message);
    }
  }

  if (current.status !== "draft" && current.status !== "pending") {
    return NextResponse.json(
      {
        ok: false,
        error: rpcError
          ? formatErrorMessage(rpcError, "Не удалось завершить отправку.")
          : "Некорректный статус для финализации."
      },
      { status: 400 }
    );
  }

  const { data: upd, error: upErr } = await admin
    .from("releases")
    .update({ status: "processing", error_message: null })
    .eq("id", releaseId)
    .eq("client_request_id", clientRequestId)
    .in("status", ["draft", "pending"])
    .select("*");

  if (upErr) {
    console.error("[finalize-submit] fallback update:", upErr.message);
    return NextResponse.json(
      {
        ok: false,
        error: rpcError
          ? formatErrorMessage(rpcError, "Не удалось завершить отправку.")
          : formatErrorMessage(upErr, "Не удалось обновить статус.")
      },
      { status: 500 }
    );
  }

  const rows = upd as ReleaseRecord[] | null;
  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Обновление не применилось (конкурентное изменение?)." },
      { status: 409 }
    );
  }

  await notifyReleaseSubmittedForModeration(rows[0], telegramUserId);
  return NextResponse.json({ ok: true, record: rows[0] });
}

export const POST = withTelegramAuth(handleFinalizeSubmit);
