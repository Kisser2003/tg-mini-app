/** Условия использования бита (колонка `releases.license_type`). */
export const LICENSE_TYPE_VALUES = ["own", "exclusive", "lease", "free"] as const;
export type LicenseType = (typeof LICENSE_TYPE_VALUES)[number];

export const LICENSE_TYPE_LABELS: Record<LicenseType, string> = {
  own: "Свой бит (я автор музыки)",
  exclusive: "Эксклюзив (выкуплен полностью)",
  lease: "Аренда / лизинг",
  free: "Бесплатный (free for profit)"
};

export function isLicenseType(v: unknown): v is LicenseType {
  return typeof v === "string" && (LICENSE_TYPE_VALUES as readonly string[]).includes(v);
}

/** Жанры мастера; значение уходит в `releases.genre` как есть. */
export const GENRE_OPTIONS: { value: string; label: string }[] = [
  { value: "Hip-Hop/Rap", label: "Hip-Hop / Rap" },
  { value: "Trap", label: "Trap" },
  { value: "Drill", label: "Drill" },
  { value: "Phonk", label: "Phonk" },
  { value: "R&B/Soul", label: "R&B / Soul" },
  { value: "Pop", label: "Pop" },
  { value: "Indie", label: "Indie" },
  { value: "Alternative", label: "Alternative" },
  { value: "Rock", label: "Rock" },
  { value: "Electronic", label: "Electronic" },
  { value: "House", label: "House" },
  { value: "Techno", label: "Techno" },
  { value: "Dance", label: "Dance" },
  { value: "Lo-Fi", label: "Lo-Fi" },
  { value: "Other", label: "Другое" }
];

/** Старое значение из БД → актуальное (раньше в списке был `Hip-hop`). */
export function normalizeGenre(v: string | null | undefined): string {
  const t = String(v ?? "").trim();
  if (t === "Hip-hop") return "Hip-Hop/Rap";
  return t;
}

/** «0:45», «1:05», «45» → секунды; null, если формат неверный. */
export function parseTimecodeToSeconds(input: string | null | undefined): number | null {
  const t = String(input ?? "").trim();
  if (!t) return null;
  const mmss = /^(\d{1,2}):([0-5]\d)$/.exec(t);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  if (/^\d{1,4}$/.test(t)) return Number(t);
  return null;
}

export function formatSecondsAsTimecode(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "";
  const n = Math.floor(sec);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}
