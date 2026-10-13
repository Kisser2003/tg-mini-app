import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const initTelegramWebApp = vi.fn();

vi.mock("../lib/telegram", () => ({
  getTelegramApiAuthHeaders: () => ({ "X-Telegram-Init-Data": "signed" }),
  initTelegramWebApp: () => initTelegramWebApp()
}));

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("releaseApiRequest", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    initTelegramWebApp.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("шлёт initData и тело, не шлёт x-telegram-user-id", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true, record: { id: "r1" } }));
    const { releaseApiRequest } = await import("@/lib/api/release-client");
    const res = await releaseApiRequest<{ ok: true; record: { id: string } }>("/api/releases/tracks", {
      method: "POST",
      body: { a: 1 }
    });
    expect(res.record.id).toBe("r1");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Telegram-Init-Data"]).toBe("signed");
    expect(headers["x-telegram-user-id"]).toBeUndefined();
    expect(init.credentials).toBe("include");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("на 401 переинициализирует WebApp и повторяет один раз", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { ok: false, error: "Unauthorized" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const { releaseApiRequest } = await import("@/lib/api/release-client");
    await releaseApiRequest("/api/releases/latest-draft");
    expect(initTelegramWebApp).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ошибка сервера → ReleaseApiError с текстом; 404 помечен как PGRST116", async () => {
    const { releaseApiRequest, ReleaseApiError } = await import("@/lib/api/release-client");

    fetchMock.mockResolvedValue(jsonResponse(409, { ok: false, error: "Релиз уже отправлен" }));
    await expect(releaseApiRequest("/api/releases/save-draft-patch")).rejects.toMatchObject({
      name: "ReleaseApiError",
      status: 409,
      message: "Релиз уже отправлен"
    });

    fetchMock.mockResolvedValue(jsonResponse(404, { ok: false, error: "Релиз не найден." }));
    const err = await releaseApiRequest("/api/releases/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ReleaseApiError);
    expect((err as InstanceType<typeof ReleaseApiError>).code).toBe("PGRST116");
  });

  it("не считает успехом 200 без ok: true", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));
    const { releaseApiRequest } = await import("@/lib/api/release-client");
    await expect(releaseApiRequest("/api/releases/x")).rejects.toMatchObject({ status: 200 });
  });
});
