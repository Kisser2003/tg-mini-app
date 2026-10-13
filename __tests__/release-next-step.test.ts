import { describe, it, expect } from "vitest";
import {
  MODERATION_SLA_HOURS,
  formatWaitDuration,
  getReleaseNextStep
} from "@/lib/release-next-step";

const NOW = new Date("2026-10-13T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 36e5).toISOString();

describe("getReleaseNextStep", () => {
  it("черновик и неотправленный — нужен шаг артиста", () => {
    expect(getReleaseNextStep({ status: "draft" }, NOW)).toMatchObject({
      kind: "finish_draft",
      needsAction: true,
      cardLine: "Допиши и отправь"
    });
    expect(getReleaseNextStep({ status: "pending" }, NOW)).toMatchObject({
      kind: "submit",
      needsAction: true
    });
  });

  it("отклонён — исправить", () => {
    expect(getReleaseNextStep({ status: "failed" }, NOW)).toMatchObject({
      kind: "fix",
      tone: "problem",
      needsAction: true,
      cardLine: "Исправь замечания"
    });
    expect(getReleaseNextStep({ status: "rejected" }, NOW).kind).toBe("fix");
  });

  it("на проверке: сколько ждёт, без времени — срок", () => {
    const s = getReleaseNextStep({ status: "processing", submittedAt: hoursAgo(3) }, NOW);
    expect(s).toMatchObject({ kind: "waiting", needsAction: false, cardLine: "На проверке 3 ч" });
    expect(s.body).toContain("Отправлен 3 ч назад");

    const unknown = getReleaseNextStep({ status: "processing" }, NOW);
    expect(unknown.cardLine).toBe(`Проверка до ${MODERATION_SLA_HOURS} ч`);
    expect(unknown.body).not.toContain("Отправлен");
  });

  it("на проверке дольше срока — предупреждение", () => {
    const s = getReleaseNextStep({ status: "processing", submittedAt: hoursAgo(30) }, NOW);
    expect(s).toMatchObject({ kind: "waiting_long", tone: "warn", cardLine: "Дольше обычного" });
    expect(s.body).toContain("1 дн");
  });

  it("Telegram упоминается только если уведомление придёт", () => {
    expect(getReleaseNextStep({ status: "processing", notifiesInTelegram: true }, NOW).body).toContain("Telegram");
    expect(getReleaseNextStep({ status: "processing", notifiesInTelegram: false }, NOW).body).not.toContain(
      "Telegram"
    );
  });

  it("одобрен: со ссылкой и без", () => {
    expect(getReleaseNextStep({ status: "ready", smartLink: "https://ffm.to/x" }, NOW).kind).toBe("approved_link");
    expect(getReleaseNextStep({ status: "ready", smartLink: "  " }, NOW).kind).toBe("approved_no_link");
  });

  it("неизвестный статус — без строки на плитке", () => {
    expect(getReleaseNextStep({ status: "weird" }, NOW)).toMatchObject({ kind: "unknown", cardLine: "" });
  });
});

describe("formatWaitDuration", () => {
  it.each([
    [0.2, "меньше часа"],
    [1, "1 ч"],
    [23.9, "23 ч"],
    [24, "1 дн"],
    [75, "3 дн"],
    [Number.NaN, "меньше часа"]
  ])("%s → %s", (h, out) => {
    expect(formatWaitDuration(h)).toBe(out);
  });
});
