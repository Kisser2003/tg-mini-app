import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const bodySchema = z.object({
  userId: z.number().int().nullable().optional(),
  route: z.string().nullable().optional(),
  errorMessage: z.string().min(1).max(8000),
  stackTrace: z.string().max(32000).nullable().optional(),
  componentStack: z.string().max(32000).nullable().optional(),
  extra: z.record(z.string(), z.unknown()).nullable().optional()
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { userId, route, errorMessage, stackTrace, componentStack, extra } = parsed.data;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    try {
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { error } = await admin.from("error_logs").insert({
        user_id: userId ?? null,
        route: route ?? null,
        error_message: errorMessage,
        stack_trace: stackTrace ?? null,
        component_stack: componentStack ?? null,
        extra: extra ?? null
      });
      if (error) {
        console.error("[client-error] Supabase insert failed:", error.message);
      }
    } catch (e) {
      console.error("[client-error] insert exception:", e);
    }
  } else {
    console.error("[client-error] no service role, server log only:", {
      userId,
      route,
      errorMessage
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
