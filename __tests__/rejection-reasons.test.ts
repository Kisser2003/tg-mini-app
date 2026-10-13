import { describe, it, expect } from "vitest";
import {
  REJECT_REASONS,
  REJECTION_FALLBACK_TEXT,
  describeRejection,
  faqTopicHref,
  findRejectReason,
  buildRejection,
  describePreviousRejection
} from "@/lib/rejection-reasons";
import { FAQ_TOPIC_KEYS, parseFaqTopic } from "@/lib/faq-topics";

describe("describeRejection", () => {
  it("берёт текст модератора из admin_notes, иначе из error_message", () => {
    expect(describeRejection({ adminNotes: " Обложка ", errorMessage: "x" }).message).toBe("Обложка");
    expect(describeRejection({ adminNotes: "  ", errorMessage: "Текст" }).message).toBe("Текст");
  });

  it("без текста — понятная заглушка и флаг isFallback", () => {
    const s = describeRejection({});
    expect(s.message).toBe(REJECTION_FALLBACK_TEXT);
    expect(s.isFallback).toBe(true);
  });

  it("распознаёт ключи причин, пропускает неизвестные и дубли", () => {
    const s = describeRejection({
      adminNotes: "x",
      rejectionReasons: ["artwork", "custom", "artwork", "quality"]
    });
    expect(s.reasons.map((r) => r.key)).toEqual(["artwork", "quality"]);
    expect(s.isFallback).toBe(false);
  });
});

describe("REJECT_REASONS", () => {
  it("ключи уникальны, у каждой причины есть подсказка артисту", () => {
    const keys = REJECT_REASONS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of REJECT_REASONS) expect(r.hint.length).toBeGreaterThan(10);
  });

  it("разделы «Помощи» существуют", () => {
    const topics = new Set<string>(FAQ_TOPIC_KEYS);
    for (const r of REJECT_REASONS) {
      if (r.faqTopic) expect(topics.has(r.faqTopic)).toBe(true);
    }
    expect(faqTopicHref("cover")).toBe("/requirements?topic=cover");
    expect(parseFaqTopic("cover")).toBe("cover");
    expect(parseFaqTopic("../x")).toBeNull();
  });

  it("findRejectReason", () => {
    expect(findRejectReason("artwork")?.label).toBe("Обложка");
    expect(findRejectReason("nope")).toBeNull();
  });
});

describe("buildRejection", () => {
  it("без причины — null", () => {
    expect(buildRejection([], "")).toBeNull();
    expect(buildRejection([], "  ок ")).toBeNull();
  });

  it("одна причина — её текст как есть", () => {
    const r = buildRejection(["artwork"], "");
    expect(r?.comment).toBe(findRejectReason("artwork")?.message);
    expect(r?.reasonKeys).toEqual(["artwork"]);
  });

  it("несколько причин и своя — списком, в порядке пресетов, с ключом custom", () => {
    const r = buildRejection(["quality", "caps"], "  Убери тег в конце трека  ");
    expect(r?.reasonKeys).toEqual(["caps", "quality", "custom"]);
    expect(r?.comment.split("\n")).toHaveLength(3);
    expect(r?.comment.startsWith("• ")).toBe(true);
    expect(r?.comment.endsWith("• Убери тег в конце трека")).toBe(true);
  });

  it("неизвестные ключи игнорирует, текст обрезает до лимита", () => {
    expect(buildRejection(["nope"], "")).toBeNull();
    const long = "я".repeat(5000);
    expect(buildRejection([], long)?.comment.length).toBe(2000);
  });
});

describe("describePreviousRejection", () => {
  it("только для релиза на проверке, который уже возвращали", () => {
    expect(describePreviousRejection({ status: "processing", rejection_count: 0 })).toBeNull();
    expect(describePreviousRejection({ status: "failed", rejection_count: 2 })).toBeNull();
    expect(describePreviousRejection({ status: "processing" })).toBeNull();
  });

  it("прошлые причины — названиями пресетов, иначе текстом модератора", () => {
    expect(
      describePreviousRejection({ status: "processing", rejection_count: 2, rejection_reasons: ["artwork", "caps", "custom"] })
    ).toEqual({ count: 2, summary: "Обложка, Верхний регистр" });
    const long = "а".repeat(200);
    const r = describePreviousRejection({ status: "processing", rejection_count: 1, admin_notes: long });
    expect(r?.summary.length).toBe(118);
    expect(r?.summary.endsWith("…")).toBe(true);
  });
});
