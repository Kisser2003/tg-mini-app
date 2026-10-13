import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminSupabaseClient } from "@/lib/admin-release-api-guard";
import { getTelegramAuthContextFromRequest } from "@/lib/api/with-telegram-auth";
import {
  PAYMENT_RELEASE_SELECT,
  askStudioAboutPayment,
  remindArtistToPay,
  setReleasePaymentStatus,
  type PaymentRelease
} from "@/lib/server/payment-confirm";
import { parsePaymentStatus } from "@/lib/release-payment";
import { getJsonCache, setJsonCache } from "@/lib/server/redis-cache";

export const runtime = "nodejs";

const bodySchema = z.object({
  releaseId: z.string().uuid(),
  /**
   * paid / unpaid — админ ставит сам; ask_studio — ещё раз спросить Дениса в боте;
   * remind_artist — бот просит клиента оплатить (только при «не оплачено»).
   */
  action: z.enum(["paid", "unpaid", "ask_studio", "remind_artist"])
});

/** Не чаще раза в сутки на релиз (Redis; без него — защита только в интерфейсе). */
const REMIND_COOLDOWN_SECONDS = 24 * 60 * 60;

/** Оплата релиза из админки. Клиенту бот пишет только по действию remind_artist. */
async function handleReleasePayment(request: NextRequest): Promise<Response> {
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
  const { releaseId, action } = parsed.data;

  if (action === "remind_artist") {
    const cooldownKey = `remind-pay:release:${releaseId}`;
    if (await getJsonCache<boolean>(cooldownKey)) {
      return NextResponse.json({ ok: false, error: "Уже просили сегодня." }, { status: 429 });
    }
    const reminded = await remindArtistToPay(guard.supabase, releaseId);
    if (!reminded.ok) return NextResponse.json({ ok: false, error: reminded.error }, { status: reminded.status });
    await setJsonCache(cooldownKey, true, REMIND_COOLDOWN_SECONDS);
    return NextResponse.json({ ok: true });
  }

  if (action === "ask_studio") {
    const { data: row, error } = await guard.supabase
      .from("releases")
      .select(PAYMENT_RELEASE_SELECT)
      .eq("id", releaseId)
      .maybeSingle();
    if (error) {
      console.error("[admin/release-payment] load:", error.message);
      return NextResponse.json({ ok: false, error: "Не удалось загрузить релиз." }, { status: 500 });
    }
    if (!row) return NextResponse.json({ ok: false, error: "Релиз не найден." }, { status: 404 });

    let release = row as unknown as PaymentRelease;
    if (parsePaymentStatus(release.payment_status) == null) {
      const set = await setReleasePaymentStatus(guard.supabase, releaseId, "awaiting", "admin");
      if (!set.ok) return NextResponse.json({ ok: false, error: set.error }, { status: set.status });
      release = set.release;
    }
    const asked = await askStudioAboutPayment(guard.supabase, release);
    if (!asked.ok) {
      const error =
        asked.reason === "not_configured"
          ? "Не задан Telegram id студии (PAYMENT_CONFIRMER_TELEGRAM_ID)."
          : "Бот не смог написать студии. Проверь, что Денис нажал /start у бота.";
      return NextResponse.json({ ok: false, error }, { status: asked.reason === "not_configured" ? 503 : 502 });
    }
    return NextResponse.json({ ok: true, release });
  }

  const set = await setReleasePaymentStatus(guard.supabase, releaseId, action, "admin");
  if (!set.ok) return NextResponse.json({ ok: false, error: set.error }, { status: set.status });
  return NextResponse.json({ ok: true, release: set.release });
}

export const POST = handleReleasePayment;
