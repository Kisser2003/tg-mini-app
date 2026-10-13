import { describe, it, expect } from "vitest";
import { resolveAdminHotkey } from "@/lib/hooks/useAdminHotkeys";

describe("resolveAdminHotkey", () => {
  it("клавиши и русская раскладка", () => {
    expect(resolveAdminHotkey({ key: "a" })).toBe("approve");
    expect(resolveAdminHotkey({ key: "A" })).toBe("approve");
    expect(resolveAdminHotkey({ key: "ф" })).toBe("approve");
    expect(resolveAdminHotkey({ key: "r" })).toBe("reject");
    expect(resolveAdminHotkey({ key: "к" })).toBe("reject");
    expect(resolveAdminHotkey({ key: "j" })).toBe("next");
    expect(resolveAdminHotkey({ key: "ArrowRight" })).toBe("next");
    expect(resolveAdminHotkey({ key: "k" })).toBe("prev");
    expect(resolveAdminHotkey({ key: "ArrowLeft" })).toBe("prev");
    expect(resolveAdminHotkey({ key: "x" })).toBeNull();
  });

  it("не срабатывает при вводе текста", () => {
    expect(resolveAdminHotkey({ key: "a", target: { tagName: "input" } })).toBeNull();
    expect(resolveAdminHotkey({ key: "a", target: { tagName: "TEXTAREA" } })).toBeNull();
    expect(resolveAdminHotkey({ key: "a", target: { tagName: "DIV", isContentEditable: true } })).toBeNull();
    expect(resolveAdminHotkey({ key: "a", target: { tagName: "BUTTON" } })).toBe("approve");
  });

  it("не мешает системным сочетаниям и автоповтору", () => {
    expect(resolveAdminHotkey({ key: "a", metaKey: true })).toBeNull();
    expect(resolveAdminHotkey({ key: "r", ctrlKey: true })).toBeNull();
    expect(resolveAdminHotkey({ key: "j", altKey: true })).toBeNull();
    expect(resolveAdminHotkey({ key: "A", shiftKey: true })).toBeNull();
    expect(resolveAdminHotkey({ key: "j", repeat: true })).toBeNull();
  });
});
