import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const EVENTS = [
  "wizard_step_view",
  "submit_attempt",
  "submit_success",
  "submit_error",
  "reopen_rejected"
] as const;

const bodySchema = z.object({
  anonId: z.string().min(8).max(64),
  event: z.enum(EVENTS),
  step: z.string().max(32).optional(),
  releaseId: z.string().uuid().nullable().optional(),
  props: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()])).optional()
});

/** Анонимные события воронки. Всегда 204: аналитика не должна ломать UX. */
export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return new NextResponse(null, { status: 204 });
    const admin = createSupabaseAdmin();
    if (!admin) return new NextResponse(null, { status: 204 });
    const { anonId, event, step, releaseId, props } = parsed.data;
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
