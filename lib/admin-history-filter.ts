import { normalizeReleaseStatus } from "@/lib/release-status";
import { getReleaseDisplayTitle, type ReleaseRecord } from "@/repositories/releases/types";

export type HistoryStatusFilter = "all" | "ready" | "failed";

/** Строка поиска: артист, название, ID или ссылка; без учёта регистра и «ё». */
function normalize(s: string): string {
  return s.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").trim();
}

export function matchesHistoryQuery(release: ReleaseRecord, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const hay = [release.id, release.artist_name ?? "", getReleaseDisplayTitle(release), release.smart_link ?? ""]
    .map(normalize)
    .join(" ");
  return hay.includes(q);
}

export function filterHistory<T extends { release: ReleaseRecord }>(
  rows: readonly T[],
  status: HistoryStatusFilter,
  query: string
): T[] {
  return rows.filter((row) => {
    if (status !== "all" && normalizeReleaseStatus(row.release.status) !== status) return false;
    return matchesHistoryQuery(row.release, query);
  });
}

export function countHistoryByStatus(rows: readonly { release: ReleaseRecord }[]): Record<HistoryStatusFilter, number> {
  let ready = 0;
  let failed = 0;
  for (const row of rows) {
    const s = normalizeReleaseStatus(row.release.status);
    if (s === "ready") ready += 1;
    else if (s === "failed") failed += 1;
  }
  return { all: rows.length, ready, failed };
}
