import type { ArtistRole } from "@/lib/db-enums";
import { parseArtistLinksFromJson } from "@/lib/artist-links";

export type CollaboratorEntry = {
  name: string;
  role: ArtistRole;
  spotifyUrl: string;
  appleUrl: string;
};

const ROLES: ArtistRole[] = ["primary", "featuring", "producer"];

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
