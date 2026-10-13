import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseMock } from "./helpers/supabase-mock";
import { buildReminderText } from "@/lib/server/artist-reminder";

const guard = vi.fn();
const notifyArtist = vi.fn();
const cache = new Map<string, unknown>();

vi.mock("../lib/admin-release-api-guard", () => ({
  requireAdminSupabaseClient: (...a: unknown[]) => guard(...a)
}));
vi.mock("../lib/api/with-telegram-auth", () => ({
  getTelegramAuthContextFromRequest: () => null
}));
vi.mock("../lib/server/artist-notify", async () => {
  const actual = await vi.importActual<typeof import("../lib/server/artist-notify")>("../lib/server/artist-notify");
  return { artistTelegramId: actual.artistTelegramId, notifyArtist: (...a: unknown[]) => notifyArtist(...a) };
});
vi.mock("../lib/server/redis-cache", () => ({
  getJsonCache: async (k: string) => cache.get(k) ?? null,
  setJsonCache: async (k: string, v: unknown) => {
    cache.set(k, v);
  }
}));

const ID = "11111111-1111-4111-8111-111111111111";

function useRow(row: Record<string, unknown> | null) {
  const db = createSupabaseMock(() => ({ data: row, error: null }));
  guard.mockResolvedValue({ ok: true, supabase: db.client });
}

function post(body: unknown) {
  return new NextRequest("http://localhost/api/admin/remind-artist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  guard.mockReset();
  notifyArtist.mockReset();
  cache.clear();
});

describe("POST /api/admin/remind-artist", () => {
  it("не админ — ответ гарда", async () => {
    guard.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    const { POST } = await import("@/app/api/admin/remind-artist/route");
    expect((await POST(post({ releaseId: ID }))).status).toBe(403);
  });

  it("отправляет и ставит паузу на сутки", async () => {
    useRow({ id: ID, title: "Лето", status: "pending", telegram_id: "123" });
    notifyArtist.mockResolvedValue(true);
    const { POST } = await import("@/app/api/admin/remind-artist/route");
    expect((await POST(post({ releaseId: ID }))).status).toBe(200);
    expect(notifyArtist).toHaveBeenCalledTimes(1);
    expect(String(notifyArtist.mock.calls[0][1])).toContain("Лето");

    const again = await POST(post({ releaseId: ID }));
    expect(again.status).toBe(429);
    expect(notifyArtist).toHaveBeenCalledTimes(1);
  });

  it("409 для отправленного релиза", async () => {
    useRow({ id: ID, title: "Лето", status: "processing", telegram_id: "123" });
    const { POST } = await import("@/app/api/admin/remind-artist/route");
    expect((await POST(post({ releaseId: ID }))).status).toBe(409);
    expect(notifyArtist).not.toHaveBeenCalled();
  });

  it("422 без Telegram и если артист выключил уведомления", async () => {
    const { POST } = await import("@/app/api/admin/remind-artist/route");
    useRow({ id: ID, title: "Лето", status: "draft", telegram_id: null });
    expect((await POST(post({ releaseId: ID }))).status).toBe(422);

    useRow({ id: ID, title: "Лето", status: "draft", telegram_id: "123" });
    notifyArtist.mockResolvedValue(false);
    expect((await POST(post({ releaseId: ID }))).status).toBe(422);
    expect(cache.size).toBe(0);
  });

  it("404 и 400", async () => {
    const { POST } = await import("@/app/api/admin/remind-artist/route");
    useRow(null);
    expect((await POST(post({ releaseId: ID }))).status).toBe(404);
    expect((await POST(post({ releaseId: "nope" }))).status).toBe(400);
  });
});

describe("buildReminderText", () => {
  it("разный текст для черновика и загруженных файлов, экранирует HTML", () => {
    expect(buildReminderText({ status: "pending", title: "A<b>" })).toContain("A&lt;b&gt;");
    expect(buildReminderText({ status: "pending", title: "X" })).toContain("Отправить на проверку");
    expect(buildReminderText({ status: "draft", title: "X" })).toContain("допиши релиз");
  });
});
