import { describe, it, expect } from "vitest";
import {
  MODERATION_SLA_HOURS,
  collectLibraryActions,
  formatWaitDuration,
  getReleaseNextStep,
  pluralRu
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

describe("pluralRu", () => {
  const f = ["релиз", "релиза", "релизов"] as const;
  it.each([
    [1, "релиз"],
    [2, "релиза"],
    [5, "релизов"],
    [11, "релизов"],
    [12, "релизов"],
    [21, "релиз"],
    [22, "релиза"],
    [111, "релизов"]
  ])("%s → %s", (n, out) => {
    expect(pluralRu(n, f)).toBe(out);
  });
});

describe("collectLibraryActions", () => {
  it("пусто, если всё на проверке или готово", () => {
    expect(
      collectLibraryActions([
        { id: "a", status: "processing" },
        { id: "b", status: "ready" }
      ])
    ).toEqual([]);
  });

  it("сначала возвращённые, потом неотправленные; firstId — первый в списке", () => {
    const actions = collectLibraryActions([
      { id: "d1", status: "draft" },
      { id: "f1", status: "failed" },
      { id: "p1", status: "pending" },
      { id: "f2", status: "failed" }
    ]);
    expect(actions.map((a) => [a.kind, a.count, a.firstId])).toEqual([
      ["fix", 2, "f1"],
      ["unsent", 2, "d1"]
    ]);
    expect(actions[0].text).toBe("2 релиза вернули");
    expect(actions[1].text).toBe("2 релиза не отправлены");
  });

  it("один релиз — короткий текст", () => {
    expect(collectLibraryActions([{ id: "f", status: "failed" }])[0].text).toBe("Релиз вернули");
  });
});
