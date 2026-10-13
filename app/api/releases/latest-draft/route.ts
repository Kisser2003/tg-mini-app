import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jsonError, resolveActorContext } from "@/lib/api/release-owner-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Последний незавершённый черновик (draft/pending) текущего пользователя — для «Продолжить». */
async function handleGetLatestDraft(request: NextRequest): Promise<Response> {
  const ctx = await resolveActorContext(request);
  if (!ctx.ok) return ctx.response;
  const { actor, admin } = ctx.value;

  let query = admin
    .from("releases")
    .select("id")
    .in("status", ["draft", "pending"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (actor.kind === "telegram") {
    const tid = String(actor.telegramUserId);
    query = query.or(`user_id.eq.${tid},telegram_id.eq.${tid}`);
  } else {
    query = query.eq("user_uuid", actor.authUserId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("[releases/latest-draft]:", error.message);
    return jsonError(500, "Не удалось загрузить черновик.");
  }

  const id = (data as { id?: unknown } | null)?.id;
  return NextResponse.json({ ok: true, releaseId: typeof id === "string" ? id : null });
}

export const GET = handleGetLatestDraft;
