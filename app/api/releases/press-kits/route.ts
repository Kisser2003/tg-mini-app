import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, resolveActorContext } from "@/lib/api/release-owner-route";
import { isReleaseActorOwner } from "@/lib/release-ownership.server";
import { isPitchingOpen } from "@/lib/press-kit";
import { loadPressKitRows, toPressKits } from "@/lib/server/press-kit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_IDS = 50;
const idsSchema = z.array(z.string().uuid()).min(1).max(MAX_IDS);

/** Пресс-релизы для вкладки «Питчинг»: `?ids=` — выпущенные релизы из списка артиста. Чужие отбрасываются. */
async function handleGet(request: NextRequest): Promise<Response> {
  const raw = (request.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (raw.length === 0) return NextResponse.json({ ok: true, kits: [] });
  const ids = idsSchema.safeParse([...new Set(raw)]);
  if (!ids.success) return jsonError(400, "Некорректный список релизов.");

  const ctx = await resolveActorContext(request);
  if (!ctx.ok) return ctx.response;
  const { actor, admin } = ctx.value;

  const { data, error } = await admin
    .from("releases")
    .select("id, user_id, telegram_id, user_uuid, status, smart_link")
    .in("id", ids.data);
  if (error) {
    console.error("[releases/press-kits] releases:", error.message);
    return jsonError(500, "Не удалось загрузить релизы.");
  }

  const allowed: string[] = [];
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    if (!isPitchingOpen(row.status as string | null, row.smart_link as string | null)) continue;
    if (await isReleaseActorOwner(admin, row, actor)) allowed.push(String(row.id));
  }

  const kits = await toPressKits(admin, await loadPressKitRows(admin, allowed));
  return NextResponse.json({ ok: true, kits });
}

export const GET = handleGet;
