/**
 * Webhook смены статуса релиза (Supabase/pg_net → Next).
 * Логики баланса / транзакций здесь нет и не планируется в рамках замороженного кошелька.
 */
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const WEBHOOK_VERBOSE =
  process.env.WEBHOOK_VERBOSE_LOGS === "true" || process.env.NODE_ENV !== "production";

/** Supabase Database Webhooks (INSERT / UPDATE / DELETE на `releases`). */
const supabaseWebhookSchema = z.object({
  type: z.enum(["INSERT", "UPDATE", "DELETE"]),
  table: z.string().optional(),
  schema: z.string().optional(),
  record: z.record(z.string(), z.unknown()).nullable().optional(),
  old_record: z.record(z.string(), z.unknown()).nullable().optional()
});

/** Старый формат из `pg_net` / триггера с кастомным JSON (обратная совместимость). */
const legacyWebhookBodySchema = z.object({
  id: z.string().uuid(),
  user_id: z.coerce.number().int(),
  old_status: z.string().nullable(),
  new_status: z.string(),
  error_message: z.string().nullable().optional()
});

type WebhookAuthResult =
  | { ok: true }
  | { ok: false; reason: "missing_env" | "missing_header" | "mismatch" };

function timingSafeEqualUtf8(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length || aHex.length % 2 !== 0) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(aHex, "hex"), Buffer.from(bHex, "hex"));
  } catch {
    return false;
  }
}

function collectPlainSecretsFromHeaders(request: Request): string[] {
  const names = [
    "x-supabase-signature",
    "x-supabase-webhook-secret",
    "x-webhook-secret"
  ];
  const out: string[] = [];
  for (const n of names) {
    const v = request.headers.get(n)?.trim();
    if (v) out.push(v);
  }
  const auth = request.headers.get("authorization")?.trim() ?? "";
  if (auth.length >= 7 && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) out.push(token);
  }
  return out;
}

function verifyHmacSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader?.trim()) return false;
  let sig = signatureHeader.trim();
  if (sig.toLowerCase().startsWith("sha256=")) {
    sig = sig.slice(7).trim();
  }
  const hmacHex = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  if (sig.length === 64 && /^[0-9a-fA-F]+$/.test(sig)) {
    return timingSafeEqualHex(hmacHex.toLowerCase(), sig.toLowerCase());
  }
  const hmacB64 = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  return timingSafeEqualUtf8(hmacB64, sig);
}

/**
 * Верификация секрета вебхука — всегда активна.
 * SUPABASE_WEBHOOK_SECRET обязателен: если не задан → 503.
 * Отсутствие заголовков → 401. Несовпадение → 401.
 * Bypass-флаги (WEBHOOK_REQUIRE_SECRET, SKIP_WEBHOOK_SECRET_VERIFY, WEBHOOK_DISABLE_SECRET_CHECK) удалены.
 */
function checkWebhookAuth(request: Request, rawBody: string): WebhookAuthResult {
  const expected = process.env.SUPABASE_WEBHOOK_SECRET?.trim();
  if (!expected) {
    return { ok: false, reason: "missing_env" };
  }

  const plainCandidates = collectPlainSecretsFromHeaders(request);
  for (const p of plainCandidates) {
    if (timingSafeEqualUtf8(p, expected)) {
      return { ok: true };
    }
  }

  const sigForHmac = request.headers.get("x-supabase-signature")?.trim();
  if (sigForHmac && verifyHmacSignature(rawBody, sigForHmac, expected)) {
    return { ok: true };
  }

  if (plainCandidates.length === 0 && !sigForHmac) {
    return { ok: false, reason: "missing_header" };
  }

  return { ok: false, reason: "mismatch" };
}

function statusFromRow(row: Record<string, unknown> | null | undefined): string {
  if (!row || typeof row !== "object") return "";
  const s = row.status;
  if (s == null) return "";
  return String(s).trim();
}

/** Иногда тело приходит как `{ payload: { type, record, ... } }`. */
function unwrapSupabaseWebhookJson(json: unknown): unknown {
  if (!json || typeof json !== "object") return json;
  const o = json as Record<string, unknown>;
  const p = o.payload;
  if (p != null && typeof p === "object" && "type" in p) {
    return p;
  }
  return json;
}

export async function POST(request: Request): Promise<Response> {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const auth = checkWebhookAuth(request, rawBody);

  if (!auth.ok && auth.reason === "missing_env") {
    console.error(
      "[webhooks/release-status-change] SUPABASE_WEBHOOK_SECRET is not configured"
    );
    return NextResponse.json(
      { ok: false, error: "Webhook not configured" },
      { status: 503 }
    );
  }

  if (!auth.ok) {
    const hintMissing =
      "В Supabase → Database Webhooks → HTTP Headers: имя **`x-supabase-signature`** или **`x-supabase-webhook-secret`**, " +
      "значение — **то же**, что **`SUPABASE_WEBHOOK_SECRET`** в Vercel. Либо **`Authorization: Bearer <секрет>`**.";
    const hintMismatch =
      "Секрет/HMAC не совпадает с `SUPABASE_WEBHOOK_SECRET` в Vercel. Проверьте значение заголовка в настройках вебхука.";

    console.error(
      "[webhooks/release-status-change] 401:",
      auth.reason === "missing_header" ? "нет подходящих заголовков" : "секрет/HMAC не совпал"
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
        hint: auth.reason === "missing_header" ? hintMissing : hintMismatch
      },
      { status: 401 }
    );
  }

  let json: unknown;
  try {
    json = rawBody.length === 0 ? null : JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const unwrapped = unwrapSupabaseWebhookJson(json);
  const supa = supabaseWebhookSchema.safeParse(unwrapped);
  if (supa.success) {
    const { type, table, record } = supa.data;

    if (table && table.toLowerCase() !== "releases") {
      return NextResponse.json({ ok: true, skipped: true, reason: "wrong_table" });
    }
    if (type === "DELETE") {
      return NextResponse.json({ ok: true, skipped: true, reason: "delete" });
    }
    if (record == null || typeof record !== "object") {
      return NextResponse.json({ ok: true, skipped: true, reason: "no_record" });
    }

    if (WEBHOOK_VERBOSE) {
      const row = record as Record<string, unknown>;
      console.log("[webhooks/release-status-change] ack (Telegram только из finalize-submit)", {
        type,
        status: statusFromRow(row)
      });
    }

    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "telegram_from_finalize_submit_only"
    });
  }

  const legacy = legacyWebhookBodySchema.safeParse(json);
  if (!legacy.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", details: legacy.error.flatten() },
      { status: 400 }
    );
  }

  const { new_status } = legacy.data;

  if (new_status !== "ready" && new_status !== "failed") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (WEBHOOK_VERBOSE) {
    console.log("[webhooks/release-status-change] legacy ack (no Telegram)", { new_status });
  }

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "telegram_from_finalize_submit_only"
  });
}
