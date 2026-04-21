import { normalizeReleaseStatus } from "@/lib/release-status";

/** Показывать кнопку Smart Link: выпущенный релиз с непустой ссылкой (в БД обычно `ready` + `smart_link`). */
export function shouldShowSmartLinkCta(
  status: string | null | undefined,
  smartLink: string | null | undefined
): boolean {
  const link = typeof smartLink === "string" ? smartLink.trim() : "";
  if (!link) return false;
  const raw = String(status ?? "").trim();
  if (raw.toUpperCase() === "RELEASED") return true;
  return normalizeReleaseStatus(status) === "ready";
}
