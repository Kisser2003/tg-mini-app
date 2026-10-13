import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseMock, type MockCall, type MockResult } from "./helpers/supabase-mock";

const requestPayment = vi.fn();
let dbMock = createSupabaseMock(() => ({ data: null, error: null }));

vi.mock("../lib/api/resolve-submit-actor", () => ({
  resolveReleaseActor: async () => ({ kind: "telegram", telegramUserId: 123 })
}));
vi.mock("../lib/supabase-admin", () => ({
  createSupabaseAdmin: () => dbMock.client
}));
vi.mock("../lib/release-ownership.server", () => ({
  isReleaseActorOwner: async () => true,
  numericUserIdForReleaseAiLogs: () => 123
}));
vi.mock("../lib/release-ai-moderation.server", () => ({
  runAiMetadataPrecheckForRelease: async () => ({ allow: true })
}));
vi.mock("../lib/admin-notify.server", () => ({ notifyAdminReleaseSubmitted: async () => {} }));
vi.mock("../lib/server/artist-notify", () => ({ notifyArtist: async () => true }));
vi.mock("../lib/server/release-list-cache", () => ({ invalidateMyReleasesCache: async () => {} }));
vi.mock("../lib/server/payment-confirm", () => ({
  requestPaymentConfirmationOnSubmit: (...a: unknown[]) => requestPayment(...a)
}));

const ID = "11111111-1111-4111-8111-111111111111";
const CRID = "22222222-2222-4222-8222-222222222222";
const row = { id: ID, client_request_id: CRID, status: "pending", title: "Лето", artist_name: "Ваня" };

function post(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/releases/finalize-submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ releaseId: ID, clientRequestId: CRID, ...body })
  });
}

beforeEach(() => {
  requestPayment.mockReset();
  dbMock = createSupabaseMock((call: MockCall): MockResult => {
    if (call.table === "releases" && call.op === "update") {
      return { data: [{ ...row, ...(call.payload as object), status: "processing" }], error: null };
    }
    if (call.table === "tracks") return { data: null, error: null, count: 1 } as MockResult;
    return { data: row, error: null };
  });
  // RPC finalize_release недоступна → маршрут идёт фолбэком через update.
  (dbMock.client as { rpc?: unknown }).rpc = async () => ({ data: null, error: { message: "could not find function", code: "PGRST202" } });
});

describe("finalize-submit: условия выпуска", () => {
  it("без галочки — 400, статус не меняется", async () => {
    const { POST } = await import("@/app/api/releases/finalize-submit/route");
    const res = await POST(post({}));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("условиями");
    expect(dbMock.calls.some((c) => c.op === "update")).toBe(false);
    expect(requestPayment).not.toHaveBeenCalled();
  });

  it("с галочкой — пишем время согласия, отправляем и спрашиваем оплату", async () => {
    const { POST } = await import("@/app/api/releases/finalize-submit/route");
    const res = await POST(post({ termsAccepted: true }));
    expect(res.status).toBe(200);
    const updates = dbMock.calls.filter((c) => c.table === "releases" && c.op === "update");
    expect(updates[0].payload).toHaveProperty("terms_accepted_at");
    expect(updates.some((c) => (c.payload as { status?: string }).status === "processing")).toBe(true);
    expect(requestPayment).toHaveBeenCalledTimes(1);
  });
});
