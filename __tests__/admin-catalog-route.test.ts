import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseMock, filterValue, type MockCall, type MockResult } from "./helpers/supabase-mock";

const guard = vi.fn();

vi.mock("../lib/admin-release-api-guard", () => ({
  requireAdminSupabaseClient: (...a: unknown[]) => guard(...a)
}));
vi.mock("../lib/api/with-telegram-auth", () => ({
  getTelegramAuthContextFromRequest: () => null
}));

const RELEASES = [
  { id: "r1", title: null, track_name: "Старый сингл", artist_name: "A", collaborators: null, release_type: "single", genre: "Pop", artwork_url: null, smart_link: "", upc: null, created_at: "2026-01-01T00:00:00.000Z" },
  { id: "r2", title: "EP", track_name: null, artist_name: "B", collaborators: [{ name: "C", role: "featuring" }], release_type: "ep", genre: null, artwork_url: null, smart_link: "https://band.link/x", upc: "123", created_at: "2026-02-01T00:00:00.000Z" }
];

function useDb() {
  const db = createSupabaseMock((call: MockCall): MockResult => {
    if (call.table === "releases") return { data: RELEASES, error: null };
    if (call.table === "tracks") {
      return {
        data: [
          { release_id: "r2", index: 1, title: "Два", explicit: false, duration: 90 },
          { release_id: "r2", index: 0, title: "Один", explicit: true, duration: 100 }
        ],
        error: null
      };
    }
    if (call.table === "release_logs") {
      return { data: [{ release_id: "r1", created_at: "2026-03-01T00:00:00.000Z" }], error: null };
    }
    return { data: null, error: null };
  });
  guard.mockResolvedValue({ ok: true, supabase: db.client });
  return db;
}

beforeEach(() => guard.mockReset());

describe("GET /api/admin/catalog", () => {
  it("не админ — ответ гарда", async () => {
    guard.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    const { GET } = await import("@/app/api/admin/catalog/route");
    expect((await GET(new NextRequest("http://localhost/api/admin/catalog"))).status).toBe(403);
  });

  it("только принятые; треки по порядку; старый сингл без треков — один трек; дата из лога", async () => {
    const db = useDb();
    const { GET } = await import("@/app/api/admin/catalog/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/catalog"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: Array<Record<string, unknown>> };

    const rel = db.calls.find((c) => c.table === "releases");
    expect(rel && filterValue(rel, "eq", "status")).toBe("ready");

    // r1 принят 1 марта (лог) — свежее, чем r2 (создан 1 февраля, лога нет).
    expect(body.rows.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(body.rows[0]).toMatchObject({
      title: "Старый сингл",
      accepted_at: "2026-03-01T00:00:00.000Z",
      smart_link: null,
      tracks: [{ title: "Старый сингл", explicit: false, duration: null }]
    });
    expect(body.rows[1]).toMatchObject({
      featuring: ["C"],
      upc: "123",
      tracks: [
        { title: "Один", explicit: true, duration: 100 },
        { title: "Два", explicit: false, duration: 90 }
      ]
    });
  });
});
