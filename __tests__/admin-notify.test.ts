import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { sendMessage, sendPlain } = vi.hoisted(() => ({ sendMessage: vi.fn(), sendPlain: vi.fn() }));

vi.mock("../lib/telegram-bot.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/telegram-bot.server")>("../lib/telegram-bot.server");
  return { ...actual, sendTelegramBotMessage: (...a: unknown[]) => sendMessage(...a) };
});
vi.mock("../lib/telegram-notifications", () => ({
  sendTelegramNotification: (...a: unknown[]) => sendPlain(...a)
}));

import { adminReleaseWebAppUrl, notifyAdminReleaseSubmitted } from "@/lib/admin-notify.server";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  sendMessage.mockReset();
  sendPlain.mockReset();
  vi.stubEnv("ADMIN_TELEGRAM_ID", "42");
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "token");
});
afterEach(() => vi.unstubAllEnvs());

describe("adminReleaseWebAppUrl", () => {
  it("только https-origin без пути", () => {
    expect(adminReleaseWebAppUrl("https://app.example.com/", ID)).toBe(`https://app.example.com/admin/release/${ID}`);
    expect(adminReleaseWebAppUrl("http://localhost:3000", ID)).toBeNull();
    expect(adminReleaseWebAppUrl("https://x.com/evil", ID)).toBeNull();
    expect(adminReleaseWebAppUrl(null, ID)).toBeNull();
  });
});

describe("notifyAdminReleaseSubmitted", () => {
  it("с адресом приложения — кнопка «Открыть релиз» прямо на релиз", async () => {
    sendMessage.mockResolvedValue({ ok: true });
    await notifyAdminReleaseSubmitted({
      releaseId: ID,
      title: "Хасл",
      artist: "Sergg59",
      telegramId: "1185841744",
      appOrigin: "https://app.example.com"
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const arg = sendMessage.mock.calls[0][0] as { chatId: string; text: string; replyMarkup: unknown };
    expect(arg.chatId).toBe("42");
    expect(arg.text).toContain("«Хасл» — Sergg59");
    expect(arg.text).not.toContain("Открой админку");
    expect(arg.replyMarkup).toEqual({
      inline_keyboard: [[{ text: "Открыть релиз", web_app: { url: `https://app.example.com/admin/release/${ID}` } }]]
    });
    expect(sendPlain).not.toHaveBeenCalled();
  });

  it("Telegram не принял кнопку — то же сообщение без неё", async () => {
    sendMessage.mockResolvedValue({ ok: false, error: "BUTTON_TYPE_INVALID" });
    await notifyAdminReleaseSubmitted({ releaseId: ID, title: "Хасл", artist: "A", appOrigin: "https://app.example.com" });
    expect(sendPlain).toHaveBeenCalledTimes(1);
    expect(String(sendPlain.mock.calls[0][1])).toContain("Открой админку");
  });

  it("без адреса приложения — как раньше, текстом", async () => {
    await notifyAdminReleaseSubmitted({ releaseId: ID, title: "Хасл", artist: "A", appOrigin: "http://localhost:3000" });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(String(sendPlain.mock.calls[0][1])).toContain("Открой админку");
  });
});
