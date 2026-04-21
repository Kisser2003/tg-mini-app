import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdminSupabaseClient } from "@/lib/admin-release-api-guard";
import { getTelegramAuthContextFromRequest } from "@/lib/api/with-telegram-auth";
import type { AdminStatsResponse } from "@/types/admin";

function startOfUtcDayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

async function handleAdminStats(request: NextRequest): Promise<Response> {
  const guard = await requireAdminSupabaseClient(
    request,
    getTelegramAuthContextFromRequest(request)
  );
  if (!guard.ok) return guard.response;
  const supabase = guard.supabase;

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

  const body: AdminStatsResponse = {
    ok: true,
    pending_queue: pendingQueue ?? 0,
    ready_today: readyToday ?? 0
  };

  return NextResponse.json(body);
}

export const GET = handleAdminStats;
