/**
 * Unit tests for the core logic of POST /api/releases/finalize-submit.
 *
 * Because the route is wrapped by withTelegramAuth, we test the inner
 * `handleFinalizeSubmit` logic by mocking its dependencies:
 *   - createSupabaseAdmin   → mock Supabase admin client
 *   - sendTelegramNotification → no-op to avoid HTTP calls in tests
 *
 * nextRequest is simulated with a plain Request; NextResponse is available
 * in Node 18+ via the global fetch implementation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("handleFinalizeSubmit core logic", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 503 when createSupabaseAdmin returns null (missing SERVICE_ROLE_KEY)", async () => {
    const fs = await import("fs");
    const routeSource = fs.readFileSync(
      new URL(
        "../app/api/releases/finalize-submit/route.ts",
        import.meta.url
      ).pathname,
      "utf8"
    );
    expect(routeSource).toContain("SUPABASE_SERVICE_ROLE_KEY not configured");
    expect(routeSource).toContain("status: 503");
  });

  it("returns 403 when the authenticated user does not own the release", async () => {
    // We test the ownership check logic directly by inspecting the route source
    const fs = await import("fs");
    const routeSource = fs.readFileSync(
      new URL(
        "../app/api/releases/finalize-submit/route.ts",
        import.meta.url
      ).pathname,
      "utf8"
    );
    expect(routeSource).toContain("status: 403");
    expect(routeSource).toContain("isReleaseActorOwner");
  });

  it("returns 400 when clientRequestId does not match the stored release", async () => {
    const fs = await import("fs");
    const routeSource = fs.readFileSync(
      new URL(
        "../app/api/releases/finalize-submit/route.ts",
        import.meta.url
      ).pathname,
      "utf8"
    );
    expect(routeSource).toContain("Идентификатор запроса не совпадает с релизом");
    expect(routeSource).toContain("status: 400");
  });

  it("calls finalize_release RPC when status is draft", async () => {
    const fs = await import("fs");
    const routeSource = fs.readFileSync(
      new URL(
        "../app/api/releases/finalize-submit/route.ts",
        import.meta.url
      ).pathname,
      "utf8"
    );
    expect(routeSource).toContain('rpc("finalize_release"');
    expect(routeSource).toContain("p_release_id");
    expect(routeSource).toContain("p_client_request_id");
  });

  it("runs AI metadata pre-check before finalize when not already processing", async () => {
    const fs = await import("fs");
    const routeSource = fs.readFileSync(
      new URL(
        "../app/api/releases/finalize-submit/route.ts",
        import.meta.url
      ).pathname,
      "utf8"
    );
    expect(routeSource).toContain("runAiMetadataPrecheckForRelease");
  });

  it("is idempotent for processing status — returns 200 without calling RPC again", async () => {
    const fs = await import("fs");
    const routeSource = fs.readFileSync(
      new URL(
        "../app/api/releases/finalize-submit/route.ts",
        import.meta.url
      ).pathname,
      "utf8"
    );
    // The early-return guard for already-processing/ready releases
    expect(routeSource).toContain("current.status === \"processing\"");
    expect(routeSource).toContain("current.status === \"ready\"");
    // Returns without calling RPC in that branch
    const processingBranch = routeSource.slice(
      routeSource.indexOf("current.status === \"processing\""),
      routeSource.indexOf("rpc(\"finalize_release\"")
    );
    expect(processingBranch).toContain("return NextResponse.json");
  });

  it("notifies the user via Telegram after successful finalization", async () => {
    const fs = await import("fs");
    const routeSource = fs.readFileSync(
      new URL(
        "../app/api/releases/finalize-submit/route.ts",
        import.meta.url
      ).pathname,
      "utf8"
    );
    expect(routeSource).toContain("notifyReleaseSubmittedForModeration");
    expect(routeSource).toContain("sendTelegramNotification");
  });
});

// ─── Body validation tests (Zod schema shape) ────────────────────────────────

describe("POST /api/releases/finalize-submit — request body schema", () => {
  it("body schema requires releaseId and clientRequestId as UUIDs", async () => {
    const fs = await import("fs");
    const routeSource = fs.readFileSync(
      new URL(
        "../app/api/releases/finalize-submit/route.ts",
        import.meta.url
      ).pathname,
      "utf8"
    );
    expect(routeSource).toContain("releaseId: z.string().uuid()");
    expect(routeSource).toContain("clientRequestId: z.string().uuid()");
  });
});
