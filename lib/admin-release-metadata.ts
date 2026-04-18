import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases/types";
import { getReleaseDisplayTitle } from "@/repositories/releases/types";

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
  pushString(main, "Текст песни / лирика", release.lyrics as string | undefined);

  const lang: MetadataEntry[] = [];
  pushString(lang, "Язык", release.language as string | undefined);
  pushString(lang, "Язык исполнения", release.performance_language as string | undefined);

  const rights: MetadataEntry[] = [];
  pushString(rights, "Авторы (текст)", release.authors as string | undefined);
  pushString(rights, "Сплиты", release.splits as string | undefined);
  pushString(rights, "Автор музыки", release.music_author as string | undefined);
  pushString(rights, "Полное имя автора", release.author_full_name as string | undefined);
  pushString(rights, "Тип лицензии", release.license_type as string | undefined);
  pushString(rights, "C-line", release.c_line as string | undefined);
  pushString(rights, "P-line", release.p_line as string | undefined);

  const ids: MetadataEntry[] = [];
  pushString(ids, "ISRC", release.isrc as string | undefined);
  pushString(ids, "UPC", release.upc as string | undefined);
  pushString(ids, "Настроение (mood)", release.mood as string | undefined);

  const people: MetadataEntry[] = [];
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

export function buildReleaseExportPayload(release: AdminReleaseRow, tracks: ReleaseTrackRow[]) {
  return {
    exportedAt: new Date().toISOString(),
    release: { ...release },
    tracks: tracks.map((t) => ({ ...t }))
  };
}
