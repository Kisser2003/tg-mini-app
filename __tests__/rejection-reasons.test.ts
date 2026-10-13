import { describe, it, expect } from "vitest";
import {
  REJECT_REASONS,
  REJECTION_FALLBACK_TEXT,
  describeRejection,
  faqTopicHref,
  findRejectReason
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
