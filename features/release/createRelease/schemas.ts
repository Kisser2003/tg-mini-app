import { z } from "zod";
import { ARTIST_ROLE_VALUES, RELEASE_TYPE_VALUES } from "@/lib/db-enums";

export const artistRoleEnum = z.enum(ARTIST_ROLE_VALUES);

export const artistSchema = z.object({
  name: z.string().min(1, "Укажите имя артиста"),
  role: artistRoleEnum
});

export const metadataSchema = z.object({
  releaseTitle: z.string().min(1, "Укажите название релиза"),
  releaseType: z.enum(RELEASE_TYPE_VALUES),
  genre: z.string().min(1, "Выберите основной жанр"),
  subgenre: z.string().default(""),
  language: z.string().default(""),
  label: z.string().default(""),
  artists: z.array(artistSchema).min(1, "Добавьте хотя бы одного артиста"),
  releaseDate: z
    .string()
    .min(1, "Укажите дату релизного издания")
    .refine((value) => {
      const selected = new Date(`${value}T00:00:00`);
      if (Number.isNaN(selected.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minDate = new Date(today);
      minDate.setDate(minDate.getDate() + 5);
      return selected >= minDate;
    }, "Дата релизного издания должна быть не раньше чем через 5 дней от сегодняшней даты"),
  explicit: z.boolean()
});

export const assetsSchema = z.object({
  artworkUrl: z.string().url().nullable().default(null)
});

export const trackSchema = z.object({
  title: z.string().min(1, "Укажите название трека"),
  explicit: z.boolean().default(false)
});

export const tracksSchema = z.object({
  tracks: z.array(trackSchema).min(1, "Добавьте хотя бы один трек")
});

export function isMetadataComplete(input: unknown): boolean {
  return metadataSchema.safeParse(input).success;
}

export function isAssetsComplete(input: unknown): boolean {
  return assetsSchema.safeParse(input).success && Boolean((input as any)?.artworkUrl);
}

/**
 * releaseType rules:
 *   "single"        → exactly 1 track required
 *   "ep" | "album"  → at least 2 tracks required
 *   undefined       → at least 1 track (backward-compatible fallback)
 */
export function isTracksComplete(input: unknown, releaseType?: string): boolean {
  const parsed = tracksSchema.safeParse(input);
  if (!parsed.success) return false;
  const { tracks } = parsed.data;
  if (!tracks.every((t) => t.title.trim().length > 0)) return false;

  if (releaseType === "single") return tracks.length === 1;
  if (releaseType === "ep" || releaseType === "album") return tracks.length >= 2;
  return tracks.length >= 1;
}

