export type ArtistLinksState = {
  spotify: string;
  apple: string;
  yandex: string;
  vk: string;
};

export const EMPTY_ARTIST_LINKS: ArtistLinksState = {
  spotify: "",
  apple: "",
  yandex: "",
  vk: ""
};

const KEYS = ["spotify", "apple", "yandex", "vk"] as const;

/** Нормализация JSON из БД / API. */
export function parseArtistLinksFromJson(raw: unknown): ArtistLinksState {
  const out = { ...EMPTY_ARTIST_LINKS };
  if (raw == null || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  for (const k of KEYS) {
    const v = o[k];
    out[k] = typeof v === "string" ? v : "";
  }
  return out;
}

/** Объект для колонки JSONB (пустые строки можно не писать). */
export function artistLinksToJson(links: ArtistLinksState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of KEYS) {
    const t = links[k].trim();
    if (t.length > 0) out[k] = t;
  }
  return out;
}

/** Для валидации и merge из частичных данных API. */
export function mergeArtistLinksPartial(partial?: Partial<ArtistLinksState>): ArtistLinksState {
  return { ...EMPTY_ARTIST_LINKS, ...partial };
}
