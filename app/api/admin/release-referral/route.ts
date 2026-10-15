import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminSupabaseClient } from "@/lib/admin-release-api-guard";
import { getTelegramAuthContextFromRequest } from "@/lib/api/with-telegram-auth";
import { artistTelegramId } from "@/lib/server/artist-notify";
import { getReleaseReferral, setReferralPayout } from "@/lib/server/referrals";

export const runtime = "nodejs";

const bodySchema = z.object({
  releaseId: z.string().uuid(),
  /** true — «Выплатил», false — вернуть в «к выплате». */
  paid: z.boolean()
});

/** Отметка выплаты бонуса за приглашение на странице релиза друга. */
async function handleReleaseReferral(request: NextRequest): Promise<Response> {
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
  const { releaseId, paid } = parsed.data;

  const { data: row, error } = await guard.supabase
    .from("releases")
    .select("id, telegram_id")
    .eq("id", releaseId)
    .maybeSingle();
  if (error) {
    console.error("[admin/release-referral] load:", error.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить релиз." }, { status: 500 });
  }
  const tid = row ? artistTelegramId(row as { telegram_id?: unknown }) : null;
  if (!tid) return NextResponse.json({ ok: false, error: "Релиз не найден." }, { status: 404 });

  const result = await setReferralPayout(guard.supabase, tid, paid);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });

  const referral = await getReleaseReferral(guard.supabase, { id: releaseId, telegram_id: tid });
  return NextResponse.json({ ok: true, referral });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleReleaseReferral(request);
}
