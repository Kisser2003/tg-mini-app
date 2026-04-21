/**
 * Имена .txt для лирики в админке (скачивание и ZIP).
 */

export function buildAdminLyricsTxtFilename(args: { trackIndex: number; title: string }): string {
  const idx = String(args.trackIndex + 1).padStart(2, "0");
  const raw = args.title.trim().slice(0, 80);
  const cleaned = raw
    .replace(/[\x00-\x1f\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const safe = cleaned.length > 0 ? cleaned.replace(/ /g, "-") : "track";
  return `track-${idx}-${safe}.txt`;
}

export function buildAdminReleaseAggregatedLyricsFilename(releaseId: string): string {
  const short = releaseId.replace(/-/g, "").slice(0, 8);
  return `release-aggregated-${short}.txt`;
}
