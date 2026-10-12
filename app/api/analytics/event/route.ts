import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveReleaseActor } from "@/lib/api/resolve-submit-actor";

export const runtime = "nodejs";

const EVENTS = [
  "wizard_step_view",
  "submit_attempt",
  "submit_success",
  "submit_error",
  "reopen_rejected"
] as const;

const bodySchema = z.object({
  event: z.enum(EVENTS),
  step: z.string().max(32).optional(),
  releaseId: z.string().uuid().nullable().optional(),
  props: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()])).optional()
});

/** Анонимные события воронки. Всегда 204: аналитика не должна ломать UX. */
export async function POST(req: NextRequest) {
  try {
    // Только аутентифицированные пользователи; anon_id считаем на сервере (нельзя накрутить воронку подделкой id).
    const actor = await resolveReleaseActor(req);
    if (!actor) return new NextResponse(null, { status: 204 });
    const actorKey = actor.kind === "telegram" ? `tg:${actor.telegramUserId}` : `web:${actor.authUserId}`;
    const anonId = createHash("sha256").update(actorKey).digest("hex").slice(0, 32);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return new NextResponse(null, { status: 204 });
    const admin = createSupabaseAdmin();
    if (!admin) return new NextResponse(null, { status: 204 });
    const { event, step, releaseId, props } = parsed.data;
    const propsJson = JSON.stringify(props ?? {});
    await admin.from("funnel_events").insert({
      anon_id: anonId,
      event,
      step: step ?? null,
      release_id: releaseId ?? null,
      props: propsJson.length <= 1000 ? (props ?? {}) : {}
    });
  } catch {
    /* ignore */
  }
  return new NextResponse(null, { status: 204 });
}
