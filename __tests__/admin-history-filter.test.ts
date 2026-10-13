import { describe, it, expect } from "vitest";
import { countHistoryByStatus, filterHistory } from "@/lib/admin-history-filter";
import type { ReleaseRecord } from "@/repositories/releases/types";

const row = (id: string, status: string, artist: string, title: string, smart_link: string | null = null) => ({
  release: { id, status, artist_name: artist, title, smart_link } as unknown as ReleaseRecord
});

const rows = [
  row("a1", "ready", "Mira", "Лето", "https://ffm.to/leto"),
  row("b2", "failed", "Kosh", "Пыль"),
  row("c3", "ready", "Алёна", "Ёлка")
];

describe("filterHistory", () => {
  it("по статусу", () => {
    expect(filterHistory(rows, "ready", "").map((r) => r.release.id)).toEqual(["a1", "c3"]);
    expect(filterHistory(rows, "failed", "").map((r) => r.release.id)).toEqual(["b2"]);
    expect(filterHistory(rows, "all", "")).toHaveLength(3);
  });

  it("поиск по артисту, названию, id и ссылке; регистр и ё не важны", () => {
    expect(filterHistory(rows, "all", "mira").map((r) => r.release.id)).toEqual(["a1"]);
    expect(filterHistory(rows, "all", "ПЫЛЬ").map((r) => r.release.id)).toEqual(["b2"]);
    expect(filterHistory(rows, "all", "алена").map((r) => r.release.id)).toEqual(["c3"]);
    expect(filterHistory(rows, "all", "елка").map((r) => r.release.id)).toEqual(["c3"]);
    expect(filterHistory(rows, "all", "ffm.to/leto").map((r) => r.release.id)).toEqual(["a1"]);
    expect(filterHistory(rows, "ready", "kosh")).toEqual([]);
  });
});

describe("countHistoryByStatus", () => {
  it("считает", () => {
    expect(countHistoryByStatus(rows)).toEqual({ all: 3, ready: 2, failed: 1 });
  });
});
