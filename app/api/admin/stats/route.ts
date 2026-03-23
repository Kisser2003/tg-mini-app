import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import { getExpectedAdminTelegramId } from "@/lib/admin";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { AdminStatsResponse } from "@/types/admin";

function startOfUtcDayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

async function handleAdminStats(_request: NextRequest, ctx: TelegramAuthContext): Promise<Response> {
  const adminId = getExpectedAdminTelegramId();
  if (ctx.user.id !== adminId) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseAdmin();
  if (!supabase) {
    console.error("[admin/stats] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 503 });
  }

  const dayStart = startOfUtcDayIso();

  const [{ count: pendingQueue, error: e1 }, { count: readyToday, error: e2 }] = await Promise.all([
    supabase.from("releases").select("*", { count: "exact", head: true }).eq("status", "processing"),
    supabase
      .from("releases")
      .select("*", { count: "exact", head: true })
      .eq("status", "ready")
      .gte("created_at", dayStart)
  ]);

  if (e1) {
    console.error("[admin/stats] pending_queue:", e1.message);
    return NextResponse.json({ ok: false, error: "Failed to count queue" }, { status: 500 });
  }
  if (e2) {
    console.error("[admin/stats] ready_today:", e2.message);
    return NextResponse.json({ ok: false, error: "Failed to count ready today" }, { status: 500 });
  }

  // Кошелёк заморожен — не суммируем pending по `transactions` (раньше было через отдельный запрос).
  const pendingHoldSum = 0;

  const body: AdminStatsResponse = {
    ok: true,
    pending_queue: pendingQueue ?? 0,
    ready_today: readyToday ?? 0,
    pending_hold_sum: pendingHoldSum
  };

  return NextResponse.json(body);
}

export const GET = withTelegramAuth(handleAdminStats);
