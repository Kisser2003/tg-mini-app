export type CanonicalReleaseStatus = "draft" | "processing" | "ready" | "failed";

export function normalizeReleaseStatus(status: string | null | undefined): CanonicalReleaseStatus {
  const value = (status ?? "").toLowerCase().trim();

  if (value === "processing" || value === "under_review" || value === "review") {
    return "processing";
  }
  if (value === "ready") {
    return "ready";
  }
  if (value === "failed" || value === "rejected") {
    return "failed";
  }
  return "draft";
}

export function getReleaseStatusLabel(status: string | null | undefined): string {
  const normalized = normalizeReleaseStatus(status);

  if (normalized === "processing") return "На проверке";
  if (normalized === "ready") return "Готов";
  if (normalized === "failed") return "Ошибка";
  return "Черновик";
}

