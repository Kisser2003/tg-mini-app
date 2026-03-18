export const RELEASE_STATUS_VALUES = [
  "draft",
  "processing",
  "under_review",
  "ready",
  "failed"
] as const;

export type ReleaseStatus = (typeof RELEASE_STATUS_VALUES)[number];

export const RELEASE_TYPE_VALUES = ["single", "ep", "album"] as const;

export type ReleaseType = (typeof RELEASE_TYPE_VALUES)[number];

export const ARTIST_ROLE_VALUES = ["primary", "featuring"] as const;

export type ArtistRole = (typeof ARTIST_ROLE_VALUES)[number];
