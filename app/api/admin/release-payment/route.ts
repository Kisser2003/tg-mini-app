import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminSupabaseClient } from "@/lib/admin-release-api-guard";
import { getTelegramAuthContextFromRequest } from "@/lib/api/with-telegram-auth";
import {
  PAYMENT_RELEASE_SELECT,
  askStudioAboutPayment,
  setReleasePaymentStatus,
  type PaymentRelease
} from "@/lib/server/payment-confirm";
import { parsePaymentStatus } from "@/lib/release-payment";

export const runtime = "nodejs";

const bodySchema = z.object({
  releaseId: z.string().uuid(),
  /** paid / unpaid — админ ставит сам; ask_studio — ещё раз спросить Дениса в боте. */
  action: z.enum(["paid", "unpaid", "ask_studio"])
});

/** Оплата релиза из админки. Артисту бот здесь не пишет — только при ответе студии. */
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
