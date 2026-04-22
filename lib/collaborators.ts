import type { ArtistRole } from "@/lib/db-enums";
import { parseArtistLinksFromJson } from "@/lib/artist-links";

export type CollaboratorEntry = {
  name: string;
  role: ArtistRole;
  spotifyUrl: string;
  appleUrl: string;
};

const ROLES: ArtistRole[] = ["primary", "featuring", "producer"];

/** Роли, которые мастер создания перезаписывает из формы; остальные (producer и т.д.) сохраняем из БД. */
const FORM_OWNED_ROLES = new Set<ArtistRole>(["primary", "featuring"]);

function isRole(v: unknown): v is ArtistRole {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

/** Нормализация одной строки из JSON БД / черновика. */
export function normalizeCollaboratorRow(raw: unknown): CollaboratorEntry {
  if (!raw || typeof raw !== "object") {
    return { name: "", role: "primary", spotifyUrl: "", appleUrl: "" };
  }
  const o = raw as Record<string, unknown>;
  const role: ArtistRole = isRole(o.role) ? o.role : "primary";
  const spotify =
    typeof o.spotifyUrl === "string"
      ? o.spotifyUrl
      : typeof o.spotify === "string"
        ? o.spotify
        : "";
  const apple =
    typeof o.appleUrl === "string"
      ? o.appleUrl
      : typeof o.apple === "string"
        ? o.apple
        : "";
  return {
    name: typeof o.name === "string" ? o.name : "",
    role,
    spotifyUrl: spotify,
    appleUrl: apple
  };
}

/** Массив участников из колонки `collaborators` (JSONB). */
export function parseCollaboratorsFromDb(raw: unknown): CollaboratorEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCollaboratorRow);
}

export type LegacyArtistLinksLike = ReturnType<typeof parseArtistLinksFromJson>;

/** Слить legacy `artist_links` (глобальные ссылки) в первого артиста. */
export function mergeLegacyGlobalLinksIntoPrimary(
  artists: CollaboratorEntry[],
  legacy: LegacyArtistLinksLike
): CollaboratorEntry[] {
  if (artists.length === 0) return artists;
  const [first, ...rest] = artists;
  const nextFirst: CollaboratorEntry = {
    ...first,
    spotifyUrl: first.spotifyUrl.trim() || legacy.spotify.trim() || "",
    appleUrl: first.appleUrl.trim() || legacy.apple.trim() || ""
  };
  return [nextFirst, ...rest];
}

/** Payload для колонки `collaborators`. */
export function serializeCollaboratorsForDb(
  artists: Array<{
    name: string;
    role: string;
    spotifyUrl?: string;
    appleUrl?: string;
  }>
): Record<string, unknown>[] {
  return artists.map((a) => ({
    name: a.name.trim(),
    role: a.role,
    ...(a.spotifyUrl?.trim() ? { spotifyUrl: a.spotifyUrl.trim() } : {}),
    ...(a.appleUrl?.trim() ? { appleUrl: a.appleUrl.trim() } : {})
  }));
}

/** Имена артистов с ролью featuring из JSONB `collaborators`. */
export function featuringNamesFromCollaboratorsJson(raw: unknown): string[] {
  return parseCollaboratorsFromDb(raw)
    .filter((c) => c.role === "featuring")
    .map((c) => c.name.trim())
    .filter((n) => n.length > 0);
}

/**
 * Слить уже сериализованный блок формы (primary + featuring) с существующим JSON из БД:
 * сохраняет producer и любые будущие роли, не управляемые мастером.
 */
export function mergeFormCollaboratorsWithExistingDb(
  formCollaboratorsPayload: unknown,
  existingCollaboratorsRaw: unknown
): Record<string, unknown>[] {
  const formPart = Array.isArray(formCollaboratorsPayload)
    ? (formCollaboratorsPayload as Record<string, unknown>[])
    : [];
  const preserved = parseCollaboratorsFromDb(existingCollaboratorsRaw).filter(
    (c) => !FORM_OWNED_ROLES.has(c.role)
  );
  return [...formPart, ...serializeCollaboratorsForDb(preserved)];
}

function buildFormOnlyCollaboratorsPayload(
  primaryArtist: string,
  featuringNames: readonly string[]
): Record<string, unknown>[] {
  const primary = primaryArtist.trim();
  const seen = new Set<string>();
  const feat = [...featuringNames]
    .map((n) => n.trim())
    .filter((n) => {
      if (n.length === 0) return false;
      const key = n.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const rows: { name: string; role: string }[] = [];
  if (primary.length > 0) {
    rows.push({ name: primary, role: "primary" });
  }
  for (const name of feat) {
    if (primary.length > 0 && name.toLowerCase() === primary.toLowerCase()) continue;
    rows.push({ name, role: "featuring" });
  }
  return serializeCollaboratorsForDb(rows);
}

/**
 * Колонка `collaborators`: основной артист + фиты из формы; при переданном `existingCollaboratorsFromDb`
 * дополнительно сохраняются записи с другими ролями (например producer из админки).
 */
export function buildCollaboratorsPayloadForDb(
  primaryArtist: string,
  featuringNames: readonly string[],
  existingCollaboratorsFromDb?: unknown
): Record<string, unknown>[] {
  const formPart = buildFormOnlyCollaboratorsPayload(primaryArtist, featuringNames);
  if (existingCollaboratorsFromDb === undefined) {
    return formPart;
  }
  return mergeFormCollaboratorsWithExistingDb(formPart, existingCollaboratorsFromDb);
}
