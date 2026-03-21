import { NextResponse } from "next/server";

/**
 * TEMP: дублирует логи saveDraft в терминал `next dev` (клиентский Supabase пишет только в DevTools).
 * Отключено в production.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    payload = { parseError: true };
  }
  console.error("[dev/log-db-error]", payload);
  return NextResponse.json({ ok: true });
}
