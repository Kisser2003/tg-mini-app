import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseMock, filterValue, type MockCall, type MockResult } from "./helpers/supabase-mock";
import { attachTracksToReleases } from "@/lib/server/admin-release-rows";
import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases.repo";

const guard = vi.fn();

vi.mock("../lib/admin-release-api-guard", () => ({
  requireAdminSupabaseClient: (...a: unknown[]) => guard(...a)
}));
vi.mock("../lib/api/with-telegram-auth", () => ({
  getTelegramAuthContextFromRequest: () => null
}));

const rel = (id: string) => ({ id, status: "processing" }) as unknown as ReleaseRecord;
const track = (release_id: string, index: number) =>
  ({ release_id, index, title: `t${index}` }) as unknown as ReleaseTrackRow;

describe("attachTracksToReleases", () => {
  it("раскладывает треки по релизам и сортирует по index", () => {
    const rows = attachTracksToReleases(
      [rel("a"), rel("b"), rel("c")],
      [track("b", 1), track("a", 2), track("a", 0), track("b", 0)]
    );
    expect(rows.map((r) => r.release.id)).toEqual(["a", "b", "c"]);
    expect(rows[0].tracks.map((t) => t.index)).toEqual([0, 2]);
    expect(rows[1].tracks.map((t) => t.index)).toEqual([0, 1]);
    expect(rows[2].tracks).toEqual([]);
  });
});

describe("GET /api/admin/moderation-queue", () => {
  beforeEach(() => guard.mockReset());

  it("грузит треки всей очереди одним запросом", async () => {
    const db = createSupabaseMock((call: MockCall): MockResult => {
      if (call.table === "releases") return { data: [rel("a"), rel("b"), rel("c")], error: null };
      return { data: [track("a", 0), track("c", 0)], error: null };
    });
    guard.mockResolvedValue({ ok: true, supabase: db.client });

    const { GET } = await import("@/app/api/admin/moderation-queue/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/moderation-queue"));
    expect(res.status).toBe(200);

    const trackCalls = db.calls.filter((c) => c.table === "tracks");
    expect(trackCalls).toHaveLength(1);
    expect(filterValue(trackCalls[0], "in", "release_id")).toEqual(["a", "b", "c"]);

    const json = (await res.json()) as { rows: { release: { id: string }; tracks: unknown[] }[] };
    expect(json.rows.map((r) => r.tracks.length)).toEqual([1, 0, 1]);
  });

  it("пустая очередь — без запроса треков", async () => {
    const db = createSupabaseMock(() => ({ data: [], error: null }));
    guard.mockResolvedValue({ ok: true, supabase: db.client });
    const { GET } = await import("@/app/api/admin/moderation-queue/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/moderation-queue"));
    expect(res.status).toBe(200);
    expect(db.calls.some((c) => c.table === "tracks")).toBe(false);
  });

  it("500 если треки не загрузились", async () => {
    const db = createSupabaseMock((call) =>
      call.table === "releases" ? { data: [rel("a")], error: null } : { data: null, error: { message: "boom" } }
    );
    guard.mockResolvedValue({ ok: true, supabase: db.client });
    const { GET } = await import("@/app/api/admin/moderation-queue/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/moderation-queue"));
    expect(res.status).toBe(500);
  });
});
