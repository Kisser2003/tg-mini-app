import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseMock, type MockCall, type MockResult } from "./helpers/supabase-mock";

const resolveReleaseActor = vi.fn();
const createSupabaseAdmin = vi.fn();

vi.mock("../lib/api/resolve-submit-actor", () => ({
  resolveReleaseActor: (...a: unknown[]) => resolveReleaseActor(...a)
}));
vi.mock("../lib/supabase-admin", () => ({
  createSupabaseAdmin: () => createSupabaseAdmin()
}));
vi.mock("../lib/admin", () => ({
  getExpectedAdminTelegramId: () => 999,
  telegramIdsEqual: (a: number, b: number) => String(a) === String(b)
}));

const RELEASE_ID = "11111111-1111-4111-8111-111111111111";

function req() {
  return new NextRequest(`http://localhost/api/releases/${RELEASE_ID}`);
}

function mockDb(row: Record<string, unknown> | null) {
  const db = createSupabaseMock((call: MockCall): MockResult => {
    if (call.table === "releases") return { data: row, error: null };
    return { data: null, error: null };
  });
  createSupabaseAdmin.mockReturnValue(db.client);
  return db;
}

describe("loadOwnedRelease", () => {
  beforeEach(() => {
    resolveReleaseActor.mockReset();
    createSupabaseAdmin.mockReset();
  });

  it("401 без проверенной сессии (заголовок x-telegram-user-id не учитывается)", async () => {
    resolveReleaseActor.mockResolvedValue(null);
    const { loadOwnedRelease } = await import("@/lib/api/release-owner-route");
    const r = await loadOwnedRelease(req(), RELEASE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("503 без service role", async () => {
    resolveReleaseActor.mockResolvedValue({ kind: "telegram", telegramUserId: 1 });
    createSupabaseAdmin.mockReturnValue(null);
    const { loadOwnedRelease } = await import("@/lib/api/release-owner-route");
    const r = await loadOwnedRelease(req(), RELEASE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(503);
  });

  it("404 если релиза нет", async () => {
    resolveReleaseActor.mockResolvedValue({ kind: "telegram", telegramUserId: 1 });
    mockDb(null);
    const { loadOwnedRelease } = await import("@/lib/api/release-owner-route");
    const r = await loadOwnedRelease(req(), RELEASE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(404);
  });

  it("403 для чужого релиза", async () => {
    resolveReleaseActor.mockResolvedValue({ kind: "telegram", telegramUserId: 1 });
    mockDb({ id: RELEASE_ID, user_id: "2", telegram_id: "2", user_uuid: null, status: "draft" });
    const { loadOwnedRelease } = await import("@/lib/api/release-owner-route");
    const r = await loadOwnedRelease(req(), RELEASE_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });

  it("пускает владельца по Telegram id", async () => {
    resolveReleaseActor.mockResolvedValue({ kind: "telegram", telegramUserId: 1 });
    mockDb({ id: RELEASE_ID, user_id: "1", telegram_id: "1", user_uuid: null, status: "draft" });
    const { loadOwnedRelease } = await import("@/lib/api/release-owner-route");
    const r = await loadOwnedRelease(req(), RELEASE_ID);
    expect(r.ok).toBe(true);
  });

  it("пускает веб-владельца только по user_uuid", async () => {
    const uuid = "22222222-2222-4222-8222-222222222222";
    resolveReleaseActor.mockResolvedValue({ kind: "web", authUserId: uuid });
    mockDb({ id: RELEASE_ID, user_id: "1", telegram_id: "1", user_uuid: uuid, status: "draft" });
    const { loadOwnedRelease } = await import("@/lib/api/release-owner-route");
    expect((await loadOwnedRelease(req(), RELEASE_ID)).ok).toBe(true);

    mockDb({ id: RELEASE_ID, user_id: "1", telegram_id: "1", user_uuid: "other", status: "draft" });
    const denied = await loadOwnedRelease(req(), RELEASE_ID);
    expect(denied.ok).toBe(false);
  });

  it("админ проходит только с allowAdmin", async () => {
    resolveReleaseActor.mockResolvedValue({ kind: "telegram", telegramUserId: 999 });
    mockDb({ id: RELEASE_ID, user_id: "2", telegram_id: "2", user_uuid: null, status: "draft" });
    const { loadOwnedRelease } = await import("@/lib/api/release-owner-route");
    expect((await loadOwnedRelease(req(), RELEASE_ID)).ok).toBe(false);
    expect((await loadOwnedRelease(req(), RELEASE_ID, { allowAdmin: true })).ok).toBe(true);
  });
});

describe("rejectIfLocked", () => {
  it("409 для processing/ready, пропускает draft/pending/failed", async () => {
    const { rejectIfLocked } = await import("@/lib/api/release-owner-route");
    expect(rejectIfLocked({ status: "processing" })?.status).toBe(409);
    expect(rejectIfLocked({ status: "ready" })?.status).toBe(409);
    expect(rejectIfLocked({ status: "draft" })).toBeNull();
    expect(rejectIfLocked({ status: "pending" })).toBeNull();
    expect(rejectIfLocked({ status: "failed" })).toBeNull();
  });
});
