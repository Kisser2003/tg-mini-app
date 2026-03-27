/**
 * Unit tests for POST /api/webhooks/release-status-change
 * Focuses on the always-enforced secret verification (checkWebhookAuth).
 *
 * The route is imported directly; NextResponse is polyfilled via the global
 * fetch available in Node 18+. No HTTP server is started.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SECRET = "test-webhook-secret-abc123";

function makeRequest(opts: {
  body?: string;
  headers?: Record<string, string>;
}): Request {
  const { body = "{}", headers = {} } = opts;
  return new Request("http://localhost/api/webhooks/release-status-change", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}

/** Valid Supabase Database Webhook payload (new-format INSERT). */
const VALID_SUPA_BODY = JSON.stringify({
  type: "UPDATE",
  table: "releases",
  schema: "public",
  record: { id: "00000000-0000-0000-0000-000000000001", status: "ready" },
  old_record: { id: "00000000-0000-0000-0000-000000000001", status: "processing" }
});

function hmacSha256Hex(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/webhooks/release-status-change — secret verification", () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.SUPABASE_WEBHOOK_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.SUPABASE_WEBHOOK_SECRET;
    } else {
      process.env.SUPABASE_WEBHOOK_SECRET = originalSecret;
    }
    vi.resetModules();
  });

  it("returns 503 when SUPABASE_WEBHOOK_SECRET is not set", async () => {
    delete process.env.SUPABASE_WEBHOOK_SECRET;
    const { POST } = await import(
      "../app/api/webhooks/release-status-change/route"
    );
    const res = await POST(makeRequest({ body: VALID_SUPA_BODY }));
    expect(res.status).toBe(503);
  });

  it("returns 401 when no auth header is provided", async () => {
    process.env.SUPABASE_WEBHOOK_SECRET = SECRET;
    const { POST } = await import(
      "../app/api/webhooks/release-status-change/route"
    );
    const res = await POST(makeRequest({ body: VALID_SUPA_BODY }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when the plain-text secret header is wrong", async () => {
    process.env.SUPABASE_WEBHOOK_SECRET = SECRET;
    const { POST } = await import(
      "../app/api/webhooks/release-status-change/route"
    );
    const res = await POST(
      makeRequest({
        body: VALID_SUPA_BODY,
        headers: { "x-supabase-webhook-secret": "wrong-secret" }
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 when the correct plain-text secret is provided", async () => {
    process.env.SUPABASE_WEBHOOK_SECRET = SECRET;
    const { POST } = await import(
      "../app/api/webhooks/release-status-change/route"
    );
    const res = await POST(
      makeRequest({
        body: VALID_SUPA_BODY,
        headers: { "x-supabase-webhook-secret": SECRET }
      })
    );
    expect(res.status).toBe(200);
  });

  it("returns 200 when a valid HMAC-SHA256 signature is provided", async () => {
    process.env.SUPABASE_WEBHOOK_SECRET = SECRET;
    const { POST } = await import(
      "../app/api/webhooks/release-status-change/route"
    );
    const sig = hmacSha256Hex(VALID_SUPA_BODY, SECRET);
    const res = await POST(
      makeRequest({
        body: VALID_SUPA_BODY,
        headers: { "x-supabase-signature": sig }
      })
    );
    expect(res.status).toBe(200);
  });

  it("returns 401 when an invalid HMAC-SHA256 signature is provided", async () => {
    process.env.SUPABASE_WEBHOOK_SECRET = SECRET;
    const { POST } = await import(
      "../app/api/webhooks/release-status-change/route"
    );
    const sig = hmacSha256Hex(VALID_SUPA_BODY, "different-secret");
    const res = await POST(
      makeRequest({
        body: VALID_SUPA_BODY,
        headers: { "x-supabase-signature": sig }
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 when the correct secret is passed as a Bearer token", async () => {
    process.env.SUPABASE_WEBHOOK_SECRET = SECRET;
    const { POST } = await import(
      "../app/api/webhooks/release-status-change/route"
    );
    const res = await POST(
      makeRequest({
        body: VALID_SUPA_BODY,
        headers: { Authorization: `Bearer ${SECRET}` }
      })
    );
    expect(res.status).toBe(200);
  });
});
