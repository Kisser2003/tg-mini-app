import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import { getExpectedAdminTelegramId } from "@/lib/admin";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { AdminStatsResponse } from "@/types/admin";

/** Когда миграции кошелька (`transactions`) ещё не применены в Supabase. */
function isMissingTableInSchemaCache(e: { message?: string; code?: string }): boolean {
  const m = (e.message ?? "").toLowerCase();
  const c = String(e.code ?? "");
  return (
    c === "PGRST205" ||
    m.includes("schema cache") ||
    m.includes("could not find the table")
  );
}

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

  const [{ count: pendingQueue, error: e1 }, { count: readyToday, error: e2 }, { data: pendingRows, error: e3 }] =
    await Promise.all([
      supabase.from("releases").select("*", { count: "exact", head: true }).eq("status", "processing"),
      supabase
        .from("releases")
        .select("*", { count: "exact", head: true })
        .eq("status", "ready")
        .gte("created_at", dayStart),
      supabase.from("transactions").select("amount").eq("status", "pending")
    ]);

  if (e1) {
    console.error("[admin/stats] pending_queue:", e1.message);
    return NextResponse.json({ ok: false, error: "Failed to count queue" }, { status: 500 });
  }
  if (e2) {
    console.error("[admin/stats] ready_today:", e2.message);
    return NextResponse.json({ ok: false, error: "Failed to count ready today" }, { status: 500 });
  }
  let txRows: { amount: string | number }[] = [];
  if (e3) {
    if (isMissingTableInSchemaCache(e3)) {
      console.warn(
        "[admin/stats] таблица transactions отсутствует — pending_hold_sum=0. Примени миграции кошелька (supabase/migrations/*wallet*)."
      );
    } else {
      console.error("[admin/stats] pending transactions:", e3.message);
      return NextResponse.json({ ok: false, error: "Failed to sum pending" }, { status: 500 });
    }
  } else {
    txRows = (pendingRows ?? []) as { amount: string | number }[];
  }

  let pendingHoldSum = 0;
  for (const row of txRows) {
    const n = Number(row.amount);
    if (Number.isFinite(n)) pendingHoldSum += n;
  }

  const body: AdminStatsResponse = {
    ok: true,
    pending_queue: pendingQueue ?? 0,
    ready_today: readyToday ?? 0,
    pending_hold_sum: pendingHoldSum
  };

  return NextResponse.json(body);
}

export const GET = withTelegramAuth(handleAdminStats);
