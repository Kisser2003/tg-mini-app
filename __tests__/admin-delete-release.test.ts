import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseMock, filterValue, type MockCall, type MockResult } from "./helpers/supabase-mock";

const guard = vi.fn();
const deleteFiles = vi.fn();
const invalidate = vi.fn();

vi.mock("../lib/admin-release-api-guard", () => ({
  requireAdminSupabaseClient: (...a: unknown[]) => guard(...a)
}));
vi.mock("../lib/api/with-telegram-auth", () => ({
  getTelegramAuthContextFromRequest: () => null
}));
vi.mock("../lib/release-audio-cleanup.server", () => ({
  deleteAllReleaseFiles: (...a: unknown[]) => deleteFiles(...a)
}));
vi.mock("../lib/server/release-list-cache", () => ({
  invalidateMyReleasesCache: (...a: unknown[]) => invalidate(...a)
}));

const ID = "11111111-1111-4111-8111-111111111111";
const RELEASE = {
  id: ID,
  status: "pending",
  artwork_url: "https://x.supabase.co/storage/v1/object/public/artwork/1/" + ID + "/cover.jpg",
  audio_url: null,
  telegram_id: "1"
};

function useDb(row: Record<string, unknown> | null, opts: { deleteError?: string } = {}) {
  const db = createSupabaseMock((call: MockCall): MockResult => {
    if (call.table === "tracks") return { data: [{ file_path: "a.wav" }, { file_path: null }], error: null };
    if (call.op === "delete") {
      return { data: null, error: opts.deleteError ? { message: opts.deleteError } : null };
    }
    return { data: row, error: null };
  });
  guard.mockResolvedValue({ ok: true, supabase: db.client });
  return db;
}

function del(id: string) {
  return [
    new NextRequest(`http://localhost/api/admin/releases/${id}`, { method: "DELETE" }),
    { params: { releaseId: id } }
  ] as const;
}

beforeEach(() => {
  guard.mockReset();
  deleteFiles.mockReset();
  invalidate.mockReset();
});

describe("DELETE /api/admin/releases/[releaseId]", () => {
  it("не админ — ответ гарда, ничего не удаляем", async () => {
    guard.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    const { DELETE } = await import("@/app/api/admin/releases/[releaseId]/route");
    expect((await DELETE(...del(ID))).status).toBe(403);
    expect(deleteFiles).not.toHaveBeenCalled();
  });

  it("удаляет строку, потом файлы по ссылкам треков, сбрасывает кэш артиста", async () => {
    const db = useDb(RELEASE);
    const { DELETE } = await import("@/app/api/admin/releases/[releaseId]/route");
    const res = await DELETE(...del(ID));
    expect(res.status).toBe(200);

    const deletion = db.calls.find((c) => c.table === "releases" && c.op === "delete");
    expect(deletion && filterValue(deletion, "eq", "id")).toBe(ID);
    // Треки читаем до удаления релиза — потом их строки уйдут каскадом.
    const order = db.calls.map((c) => `${c.table}:${c.op}`);
    expect(order.indexOf("tracks:select")).toBeLessThan(order.indexOf("releases:delete"));

    expect(deleteFiles).toHaveBeenCalledTimes(1);
    expect(deleteFiles.mock.calls[0][1]).toMatchObject({ id: ID, artwork_url: RELEASE.artwork_url });
    expect(deleteFiles.mock.calls[0][2]).toEqual(["a.wav", ""]);
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ telegram_id: "1" }));
  });

  it("ошибка удаления — 500 и файлы не трогаем", async () => {
    useDb(RELEASE, { deleteError: "boom" });
    const { DELETE } = await import("@/app/api/admin/releases/[releaseId]/route");
    expect((await DELETE(...del(ID))).status).toBe(500);
    expect(deleteFiles).not.toHaveBeenCalled();
  });

  it("404 и 400", async () => {
    const { DELETE } = await import("@/app/api/admin/releases/[releaseId]/route");
    useDb(null);
    expect((await DELETE(...del(ID))).status).toBe(404);
    expect((await DELETE(...del("nope"))).status).toBe(400);
    expect(deleteFiles).not.toHaveBeenCalled();
  });
});
