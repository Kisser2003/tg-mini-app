import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminSupabaseClient } from "@/lib/admin-release-api-guard";
import { getTelegramAuthContextFromRequest } from "@/lib/api/with-telegram-auth";
import type { ReleaseRecord } from "@/repositories/releases.repo";
import { buildReminderText } from "@/lib/server/artist-reminder";
import { artistTelegramId, notifyArtist } from "@/lib/server/artist-notify";
import { getJsonCache, setJsonCache } from "@/lib/server/redis-cache";

export const runtime = "nodejs";

const bodySchema = z.object({ releaseId: z.string().uuid() });

/** Не чаще раза в сутки на релиз (Redis; без него — защита только в интерфейсе). */
const REMIND_COOLDOWN_SECONDS = 24 * 60 * 60;

/** Напомнить артисту через бота, что релиз начат, но не отправлен (блок «Застряли до отправки»). */
async function handleRemindArtist(request: NextRequest): Promise<Response> {
  const guard = await requireAdminSupabaseClient(request, getTelegramAuthContextFromRequest(request));
  if (!guard.ok) return guard.response;

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

  const { data: row, error } = await guard.supabase
    .from("releases")
    .select("id, title, track_name, status, telegram_id, user_uuid")
    .eq("id", releaseId)
    .maybeSingle();
  if (error) {
    console.error("[admin/remind-artist] load:", error.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить релиз." }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ ok: false, error: "Релиз не найден." }, { status: 404 });
  }
  const record = row as unknown as ReleaseRecord & { telegram_id?: unknown; user_uuid?: string | null };
  if (record.status !== "draft" && record.status !== "pending") {
    return NextResponse.json({ ok: false, error: "Релиз уже отправлен — напоминать не нужно." }, { status: 409 });
  }
  if (!artistTelegramId(record)) {
    return NextResponse.json(
      { ok: false, error: "У артиста нет Telegram — бот не сможет написать." },
      { status: 422 }
    );
  }

  const cooldownKey = `remind:release:${releaseId}`;
  if (await getJsonCache<boolean>(cooldownKey)) {
    return NextResponse.json({ ok: false, error: "Уже напоминали сегодня." }, { status: 429 });
  }

  const sent = await notifyArtist(record, buildReminderText(record));
  if (!sent) {
    return NextResponse.json(
      { ok: false, error: "Артист выключил уведомления — бот не пишет." },
      { status: 422 }
    );
  }
  await setJsonCache(cooldownKey, true, REMIND_COOLDOWN_SECONDS);
  return NextResponse.json({ ok: true });
}

export const POST = handleRemindArtist;
