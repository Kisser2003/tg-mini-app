import { NextResponse } from "next/server";
import { z } from "zod";
import type { NextRequest } from "next/server";
import type { TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { WalletStatsResponse, WalletTransactionRow } from "@/types/wallet";

/**
 * Будущие эндпоинты вывода (payout) должны:
 * - сверять лимиты только с `available_balance` (RPC get_user_balance с p_only_available=true),
 * - не использовать total_balance как доступный к списанию.
 */

const rowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.coerce.number().int(),
  amount: z.union([z.string(), z.number()]),
  type: z.enum(["royalty", "payout", "bonus"]),
  status: z.enum(["pending", "completed", "failed"]),
  reference_id: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  created_at: z.string()
});

function toNumber(v: string | number): number {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const WALLET_FEATURE_ENABLED = true;

async function handleWalletStats(
  _request: NextRequest,
  ctx: TelegramAuthContext
): Promise<Response> {
  if (!WALLET_FEATURE_ENABLED) {
    return NextResponse.json(
      { ok: false, error: "Wallet feature is disabled", frozen: true },
      { status: 503 }
    );
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    console.error("[wallet/stats] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json(
      { ok: false, error: "Server misconfigured" },
      { status: 503 }
    );
  }

  const userId = ctx.user.id;
  const uidStr = String(userId);

  const { data: totalRaw, error: totalErr } = await admin.rpc("get_user_balance", {
    p_user_id: uidStr,
    p_only_available: false
  });

  if (totalErr) {
    console.error("[wallet/stats] get_user_balance (total):", totalErr.message);
    return NextResponse.json({ ok: false, error: "Balance query failed" }, { status: 500 });
  }

  const { data: availableRaw, error: availErr } = await admin.rpc("get_user_balance", {
    p_user_id: uidStr,
    p_only_available: true
  });

  if (availErr) {
    console.error("[wallet/stats] get_user_balance (available):", availErr.message);
    return NextResponse.json({ ok: false, error: "Available balance query failed" }, { status: 500 });
  }

  const totalBalance = toNumber(totalRaw as string | number);
  const availableBalance = toNumber(availableRaw as string | number);

  const { data: pendingRows, error: pendErr } = await admin
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("type", "payout")
    .eq("status", "pending");

  if (pendErr) {
    console.error("[wallet/stats] pending:", pendErr.message);
    return NextResponse.json({ ok: false, error: "Pending query failed" }, { status: 500 });
  }

  let pendingWithdrawals = 0;
  for (const row of pendingRows ?? []) {
    const a = toNumber((row as { amount: string | number }).amount);
    pendingWithdrawals += Math.abs(a);
  }

  const { data: recentRaw, error: recErr } = await admin
    .from("transactions")
    .select("id, user_id, amount, type, status, reference_id, description, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (recErr) {
    console.error("[wallet/stats] recent:", recErr.message);
    return NextResponse.json({ ok: false, error: "Transactions query failed" }, { status: 500 });
  }

  const recent_transactions: WalletTransactionRow[] = [];
  for (const r of recentRaw ?? []) {
    const parsed = rowSchema.safeParse(r);
    if (!parsed.success) continue;
    const x = parsed.data;
    recent_transactions.push({
      id: x.id,
      user_id: x.user_id,
      amount: String(x.amount),
      type: x.type,
      status: x.status,
      reference_id: x.reference_id ?? null,
      description: x.description ?? null,
      created_at: x.created_at
    });
  }

  const body: WalletStatsResponse = {
    ok: true,
    total_balance: totalBalance,
    available_balance: availableBalance,
    pending_withdrawals: pendingWithdrawals,
    recent_transactions
  };

  return NextResponse.json(body);
}

export const GET = withTelegramAuth(handleWalletStats);
