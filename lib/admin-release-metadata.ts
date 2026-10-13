import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases/types";
import { getReleaseDisplayTitle } from "@/repositories/releases/types";
import { featuringNamesFromCollaboratorsJson, parseCollaboratorsFromDb } from "@/lib/collaborators";
import { parseArtistLinksFromJson } from "@/lib/artist-links";
import {
  formatSecondsAsTimecode,
  GENRE_OPTIONS,
  isLicenseType,
  LICENSE_TYPE_LABELS,
  normalizeGenre
} from "@/lib/release-rights";

function licenseLabel(v: unknown): string | null {
  if (isLicenseType(v)) return LICENSE_TYPE_LABELS[v];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function tiktokStartLabel(v: unknown): string | null {
  if (typeof v !== "number") return null;
  return formatSecondsAsTimecode(v) || null;
}

/** Строка `releases` + возможные доп. колонки из БД для админки. */
export type AdminReleaseRow = ReleaseRecord & Record<string, unknown>;

export type MetadataEntry = { label: string; value: string };

export type MetadataSection = { title: string; entries: MetadataEntry[] };

function yn(v: boolean | null | undefined): string {
  return v ? "Да" : "Нет";
}

function formatDuration(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec)) return null;
  const n = Number(sec);
  const s = Math.floor(n % 60);
  const m = Math.floor(n / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function pushString(
  entries: MetadataEntry[],
  label: string,
  v: string | null | undefined
): void {
  if (v == null) return;
  const t = String(v).trim();
  if (t.length === 0) return;
  entries.push({ label, value: t });
}

/** Всегда показываем строку (в т.ч. «—»), чтобы админ видел поле лирики. */
function pushLyricsDisplay(entries: MetadataEntry[], v: string | null | undefined): void {
  const t = v == null ? "" : String(v).trim();
  entries.push({ label: "Текст песни", value: t.length > 0 ? t : "—" });
}

function pushJson(entries: MetadataEntry[], label: string, v: unknown): void {
  if (v == null) return;
  if (typeof v === "string") {
    const t = v.trim();
    if (t.length === 0) return;
    entries.push({ label, value: t });
    return;
  }
  if (typeof v === "object") {
    if (Array.isArray(v) && v.length === 0) return;
    if (!Array.isArray(v) && Object.keys(v as object).length === 0) return;
    entries.push({ label, value: JSON.stringify(v, null, 2) });
  }
}

/**
 * Все заполненные поля релиза для админ-карточки (группы — для чтения и копирования).
 */
export function buildReleaseMetadataSections(release: AdminReleaseRow, tracks: ReleaseTrackRow[]): MetadataSection[] {
  const main: MetadataEntry[] = [];
  pushString(main, "Название релиза", getReleaseDisplayTitle(release));
  pushString(main, "Артист", release.artist_name as string | undefined);
  pushString(main, "Тип релиза", release.release_type as string | undefined);
  pushString(main, "Жанр", release.genre as string | undefined);
  pushString(main, "Поджанр", release.sub_genre as string | undefined);
  pushString(main, "Дата релиза", release.release_date as string | undefined);
  pushString(main, "Плановая дата релиза", release.planned_release_date as string | undefined);
  main.push({
    label: "Explicit (основной флаг)",
    value: yn(release.explicit as boolean | undefined)
  });
  const isEx = release.is_explicit;
  if (isEx != null) {
    main.push({ label: "Explicit (is_explicit)", value: yn(Boolean(isEx)) });
  }
  pushString(main, "Начало отрывка TikTok", tiktokStartLabel(release.tiktok_start_sec));
  pushString(main, "Текст песни / лирика", release.lyrics as string | undefined);

  const lang: MetadataEntry[] = [];
  pushString(lang, "Язык", release.language as string | undefined);
  pushString(lang, "Язык исполнения", release.performance_language as string | undefined);

  const rights: MetadataEntry[] = [];
  pushString(rights, "Авторы (текст)", release.authors as string | undefined);
  pushString(rights, "Сплиты", release.splits as string | undefined);
  pushString(rights, "Автор музыки", release.music_author as string | undefined);
  pushString(rights, "ФИО артиста", release.author_full_name as string | undefined);
  pushString(rights, "Условия бита", licenseLabel(release.license_type));
  pushString(rights, "C-line", release.c_line as string | undefined);
  pushString(rights, "P-line", release.p_line as string | undefined);

  const ids: MetadataEntry[] = [];
  pushString(ids, "ISRC", release.isrc as string | undefined);
  pushString(ids, "UPC", release.upc as string | undefined);
  pushString(ids, "Настроение (mood)", release.mood as string | undefined);

  const people: MetadataEntry[] = [];
  const featuringNames = featuringNamesFromCollaboratorsJson(release.collaborators);
  if (featuringNames.length > 0) {
    people.push({ label: "Доп. артисты (feat.)", value: featuringNames.join(", ") });
  }
  pushJson(people, "Участники (collaborators)", release.collaborators);
  pushJson(people, "Ссылки артиста (artist_links)", release.artist_links);

  const tech: MetadataEntry[] = [];
  pushString(tech, "ID релиза", release.id);
  pushString(tech, "Client request ID", release.client_request_id as string | undefined);
  const uid = release.user_id;
  if (uid != null) pushString(tech, "User ID (legacy)", String(uid));
  pushString(tech, "User UUID", release.user_uuid as string | undefined);
  const tg = release.telegram_id;
  if (tg != null) pushString(tech, "Telegram ID", String(tg));
  pushString(tech, "Telegram @", release.telegram_username as string | undefined);
  pushString(tech, "Статус", release.status as string | undefined);
  pushString(tech, "Создан", release.created_at as string | undefined);
  if (release.has_existing_profiles != null) {
    tech.push({
      label: "Есть профили на DSP",
      value: yn(Boolean(release.has_existing_profiles))
    });
  }
  if (release.draft_upload_started != null) {
    tech.push({
      label: "Черновик загрузки начат",
      value: yn(Boolean(release.draft_upload_started))
    });
  }
  pushString(tech, "URL аудио (legacy)", release.audio_url as string | undefined);
  pushString(tech, "URL обложки", release.artwork_url as string | undefined);
  pushString(tech, "Сообщение об ошибке", release.error_message as string | undefined);
  pushString(tech, "Заметки админа", release.admin_notes as string | undefined);
  pushString(tech, "Заметки модератора", release.moderator_notes as string | undefined);

  const trackSections: MetadataSection[] = tracks.map((t, i) => {
    const te: MetadataEntry[] = [];
    const idx = t.index ?? i;
    pushString(te, "Позиция (index)", String(idx));
    if (t.position != null) pushString(te, "Position", String(t.position));
    pushString(te, "Название трека", t.title);
    pushLyricsDisplay(te, t.lyrics);
    te.push({ label: "Explicit", value: yn(t.explicit) });
    const dur = formatDuration(t.duration);
    if (dur) te.push({ label: "Длительность", value: dur });
    if (t.id) pushString(te, "ID трека", t.id);
    pushString(te, "Файл (URL в Storage)", t.file_path ?? undefined);
    return {
      title: `Трек ${idx + 1}`,
      entries: te
    };
  });

  const sections: MetadataSection[] = [
    { title: "Основное", entries: main },
    { title: "Языки", entries: lang },
    { title: "Авторство и право", entries: rights },
    { title: "Идентификаторы и теги", entries: ids },
    { title: "Участники и ссылки", entries: people },
    { title: "Служебное", entries: tech },
    ...trackSections
  ];

  return sections.filter((s) => s.entries.length > 0);
}

function formatReleaseDateRu(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
  return m ? `${m[3]}.${m[2]}.${m[1]}` : v.trim() || null;
}

function genreLabel(v: unknown): string | null {
  const g = normalizeGenre(typeof v === "string" ? v : null);
  if (!g) return null;
  return GENRE_OPTIONS.find((o) => o.value === g)?.label ?? g;
}

/**
 * Текст «Формы релиза» в формате, который принимают коллеги при ручной отгрузке.
 * Обложка, WAV и текст отправляются отдельными файлами — в форме только пометка.
 */
export function buildColleagueReleaseForm(release: AdminReleaseRow, tracks: ReleaseTrackRow[]): string {
  const dash = "—";
  const featuring = featuringNamesFromCollaboratorsJson(release.collaborators);
  const artist = [release.artist_name?.trim(), featuring.length > 0 ? `feat. ${featuring.join(", ")}` : null]
    .filter(Boolean)
    .join(" ");
  const explicit = Boolean(release.explicit ?? release.is_explicit) || tracks.some((t) => t.explicit);
  const tiktokSec = typeof release.tiktok_start_sec === "number" ? release.tiktok_start_sec : null;
  const tiktok = tiktokSec != null ? `${formatSecondsAsTimecode(tiktokSec)} (${Math.floor(tiktokSec)} сек)` : null;
  const license = licenseLabel(release.license_type);
  const musicAuthor = typeof release.music_author === "string" ? release.music_author.trim() : "";
  const beat = [license, musicAuthor ? `автор бита: ${musicAuthor}` : null].filter(Boolean).join(", ");
  const audioCount = tracks.filter((t) => t.file_path?.trim()).length;

  const lines = [
    "Форма релиза",
    "",
    `1. Название релиза: ${getReleaseDisplayTitle(release) || dash}`,
    `2. Исполнитель: ${artist || dash}`,
    "3. Обложка (3000 на 3000), JPG: файлом",
    `4. Трек в формате WAV: файлом${audioCount > 1 ? ` (${audioCount} шт.)` : ""}`,
    `5. Жанр: ${genreLabel(release.genre) || dash}`,
    `6. Ненормативная лексика: ${explicit ? "Есть" : "Нет"}`,
    `7. ФИО артиста(-ов): ${(release.author_full_name as string | undefined)?.trim() || dash}`,
    `8. Начало отрывка песни в ТикТок: ${tiktok || dash}`,
    `9. Дата релиза: ${formatReleaseDateRu(release.release_date) || dash}`,
    `10. Условия использования бита: ${beat || dash}`,
    "11. Текст релиза: файлом"
  ];

  const links = parseArtistLinksFromJson(release.artist_links);
  const primary = parseCollaboratorsFromDb(release.collaborators).find((c) => c.role === "primary");
  const linkRows = [
    ["Яндекс Музыка", links.yandex],
    ["ВК", links.vk],
    ["Apple Music", links.apple || primary?.appleUrl || ""],
    ["Spotify", links.spotify || primary?.spotifyUrl || ""]
  ].filter(([, url]) => url.trim());
  if (linkRows.length > 0) {
    lines.push("", "Карточки артиста:", ...linkRows.map(([name, url]) => `${name}: ${url.trim()}`));
  }

  return lines.join("\n");
}

export function buildReleaseExportPayload(release: AdminReleaseRow, tracks: ReleaseTrackRow[]) {
  return {
    exportedAt: new Date().toISOString(),
    /** Человекочитаемые поля для анкеты дистрибьютора. */
    distribution: {
      title: getReleaseDisplayTitle(release),
      artist: release.artist_name ?? null,
      genre: release.genre ?? null,
      explicit: Boolean(release.explicit ?? release.is_explicit),
      release_date: release.release_date ?? null,
      author_full_name: release.author_full_name ?? null,
      music_author: release.music_author ?? null,
      license_type: release.license_type ?? null,
      license_type_label: licenseLabel(release.license_type),
      tiktok_start_sec: release.tiktok_start_sec ?? null,
      tiktok_start: tiktokStartLabel(release.tiktok_start_sec),
      artist_links: release.artist_links ?? {}
    },
    release: { ...release },
    tracks: tracks.map((t) => ({ ...t }))
  };
}

/**
 * Следующий релиз очереди после решения по `currentId`: следующий по списку,
 * если текущий был последним — первый оставшийся. `null` — очередь разобрана.
 */
export function pickNextReleaseId(queueIds: readonly string[], currentId: string): string | null {
  const rest = queueIds.filter((id) => id !== currentId);
  if (rest.length === 0) return null;
  const idx = queueIds.indexOf(currentId);
  if (idx === -1) return rest[0];
  return queueIds.slice(idx + 1).find((id) => id !== currentId) ?? rest[0];
}

function shortReleaseType(type: unknown): string | null {
  if (type === "single") return "Сингл";
  if (type === "ep") return "EP";
  if (type === "album") return "Альбом";
  return typeof type === "string" && type.trim() ? type.trim() : null;
}

function shortDateRu(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "");
}

/** Короткая сводка для решения с первого экрана: формат, жанр, мат, треки, дата выхода. */
export function buildAdminReleaseSummary(release: AdminReleaseRow, tracks: ReleaseTrackRow[]): string[] {
  const parts: (string | null)[] = [];
  parts.push(shortReleaseType(release.release_type));
  parts.push(typeof release.genre === "string" && release.genre.trim() ? release.genre.trim() : null);
  const trackCount = tracks.length;
  if (trackCount > 1) {
    const mod10 = trackCount % 10;
    const mod100 = trackCount % 100;
    const word =
      mod10 === 1 && mod100 !== 11
        ? "трек"
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
          ? "трека"
          : "треков";
    parts.push(`${trackCount} ${word}`);
  }
  const explicit = Boolean(release.explicit) || tracks.some((t) => Boolean(t.explicit));
  parts.push(explicit ? "есть мат" : "без мата");
  const date = shortDateRu(release.release_date);
  if (date) parts.push(`выход ${date}`);
  return parts.filter((p): p is string => Boolean(p));
}

/** «5 мин назад», «3 ч назад», «2 дн назад». */
export function formatAgoRu(iso: string, now: Date = new Date()): string {
  const min = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (!Number.isFinite(min)) return "";
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.round(h / 24)} дн назад`;
}

/** Предыдущий релиз очереди (по кругу); `null`, если листать некуда. */
export function pickPrevReleaseId(queueIds: readonly string[], currentId: string): string | null {
  const rest = queueIds.filter((id) => id !== currentId);
  if (rest.length === 0) return null;
  const idx = queueIds.indexOf(currentId);
  if (idx <= 0) return rest[rest.length - 1];
  return queueIds[idx - 1];
}
