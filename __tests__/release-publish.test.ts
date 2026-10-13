import { describe, it, expect } from "vitest";
import { normalizeUpc } from "@/lib/admin-release-publish";
import { acceptedMessage, linkReadyMessage } from "@/lib/server/release-notify-texts";

describe("normalizeUpc", () => {
  it("пусто — null, 12/13 цифр с пробелами и дефисами — ок", () => {
    expect(normalizeUpc("")).toBeNull();
    expect(normalizeUpc(undefined)).toBeNull();
    expect(normalizeUpc(" 1234 5678-9012 ")).toBe("123456789012");
    expect(normalizeUpc("1234567890123")).toBe("1234567890123");
  });
  it("иначе ошибка", () => {
    expect(() => normalizeUpc("123")).toThrow("12 или 13 цифр");
    expect(() => normalizeUpc("12345678901a")).toThrow();
  });
});

describe("тексты бота", () => {
  it("принят: срок площадок и обещание ссылки, HTML экранирован", () => {
    const m = acceptedMessage("A<b>");
    expect(m).toContain("A&lt;b&gt;");
    expect(m).toContain("3–5 дней");
    expect(m).toContain("пресейв");
  });
  it("ссылка: разный заголовок для «сразу» и «позже»", () => {
    expect(linkReadyMessage("X", "https://band.link/x", { acceptedNow: false })).toContain("прошёл модерацию площадок");
    expect(linkReadyMessage("X", "https://band.link/x", { acceptedNow: true })).toContain("принят и уже прошёл");
    expect(linkReadyMessage("X", "https://band.link/x?a=1&b=2", { acceptedNow: false })).toContain("a=1&amp;b=2");
  });
});
