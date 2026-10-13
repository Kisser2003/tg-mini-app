import { describe, it, expect } from "vitest";
import { buildAdminReleaseSummary, pickNextReleaseId, type AdminReleaseRow } from "@/lib/admin-release-metadata";
import type { ReleaseTrackRow } from "@/repositories/releases/types";

describe("pickNextReleaseId", () => {
  it("следующий по очереди", () => {
    expect(pickNextReleaseId(["a", "b", "c"], "a")).toBe("b");
    expect(pickNextReleaseId(["a", "b", "c"], "b")).toBe("c");
  });
  it("последний — первый оставшийся", () => {
    expect(pickNextReleaseId(["a", "b", "c"], "c")).toBe("a");
  });
  it("текущего нет в очереди — первый", () => {
    expect(pickNextReleaseId(["a", "b"], "x")).toBe("a");
  });
  it("очередь разобрана", () => {
    expect(pickNextReleaseId(["a"], "a")).toBeNull();
    expect(pickNextReleaseId([], "a")).toBeNull();
  });
});

describe("buildAdminReleaseSummary", () => {
  const tr = (explicit: boolean) => ({ explicit }) as unknown as ReleaseTrackRow;
  it("формат, жанр, треки, мат по трекам, дата", () => {
    const row = { release_type: "ep", genre: " Trap ", explicit: false, release_date: "2026-11-01" } as unknown as AdminReleaseRow;
    expect(buildAdminReleaseSummary(row, [tr(false), tr(true), tr(false)])).toEqual([
      "EP",
      "Trap",
      "3 трека",
      "есть мат",
      "выход 1 нояб"
    ]);
  });
  it("один трек без мата и без даты", () => {
    const row = { release_type: "single", genre: "", explicit: false } as unknown as AdminReleaseRow;
    expect(buildAdminReleaseSummary(row, [tr(false)])).toEqual(["Сингл", "без мата"]);
  });
  it("5 треков", () => {
    const row = { release_type: "album" } as unknown as AdminReleaseRow;
    expect(buildAdminReleaseSummary(row, Array.from({ length: 5 }, () => tr(false)))).toContain("5 треков");
  });
});
