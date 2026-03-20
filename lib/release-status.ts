export type CanonicalReleaseStatus =
  | "draft"
  | "processing"
  | "ready"
  | "failed"
  | "unknown";

export type ReleaseStatusMeta = {
  canonical: CanonicalReleaseStatus;
  label: string;
  badgeClassName: string;
  /** Лёгкий glow только для успешного статуса (UI). */
  badgeGlowClassName?: string;
};

const STATUS_META: Record<CanonicalReleaseStatus, Omit<ReleaseStatusMeta, "canonical">> = {
  draft: {
    label: "Черновик",
    badgeClassName: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300"
  },
  processing: {
    label: "На проверке",
    badgeClassName: "border-amber-500/40 bg-amber-500/15 text-amber-300"
  },
  ready: {
    label: "Готов",
    badgeClassName: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    /** «Дыхание» свечения для премиального акцента статуса */
    badgeGlowClassName: "shadow-[0_0_15px_rgba(34,197,94,0.3)] animate-pulse"
  },
  failed: {
    label: "Отклонено",
    badgeClassName: "border-rose-500/40 bg-rose-500/15 text-rose-300"
  },
  unknown: {
    label: "Неизвестно",
    badgeClassName: "border-sky-500/35 bg-sky-500/10 text-sky-300"
  }
};

export function normalizeReleaseStatus(status: string | null | undefined): CanonicalReleaseStatus {
  const value = (status ?? "").toLowerCase().trim();

  if (value === "draft") return "draft";
  if (value === "processing" || value === "under_review" || value === "review" || value === "pending") {
    return "processing";
  }
  if (value === "ready" || value === "approved" || value === "live") return "ready";
  if (value === "failed" || value === "rejected" || value === "error") return "failed";
  if (!value) return "unknown";
  return "unknown";
}

export function getReleaseStatusMeta(status: string | null | undefined): ReleaseStatusMeta {
  const canonical = normalizeReleaseStatus(status);
  return {
    canonical,
    ...STATUS_META[canonical]
  };
}

export function getReleaseStatusLabel(status: string | null | undefined): string {
  return getReleaseStatusMeta(status).label;
}

