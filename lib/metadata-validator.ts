/**
 * DSP-oriented проверки метаданных релиза (мягкие предупреждения на клиенте,
 * критические — блокируют submit-precheck на сервере).
 */

const MIN_FIELD_LEN = 2;
const MAX_FIELD_LEN = 256;

/** Подряд 4+ заглавных латиница или кириллица (DJ, USA — допустимы). */
const CAPS_RUN = /[A-Z]{4,}|[А-ЯЁ]{4,}/;
const FORBIDDEN_SYMBOLS = /[$@]/;
const MULTI_BANG = /!{3,}/;
const EMOJI = /\p{Extended_Pictographic}/u;
const PROD_BY = /\b(?:prod\.?\s*by|produced\s+by)\b/i;
const TRACK_ONE = /\btrack\s*1\b/i;
const ORIGINAL_MIX = /\boriginal\s+mix\b/i;

export type ReleaseMetadata = {
  artists: { name: string }[];
  releaseTitle: string;
  /** Названия треков; если не переданы — проверяются только релиз и артисты. */
  trackTitles?: string[];
};

export type MetadataValidationResult = {
  /** Нет критических нарушений (можно пропускать submit-precheck по метаданным). */
  isValid: boolean;
  /** Только критические сообщения (для API и toast). */
  errors: string[];
};

function hasLetter(s: string): boolean {
  return /\p{L}/u.test(s);
}

function checkCriticalContent(trimmed: string): string | null {
  if (trimmed.length === 0) return "Поле не может быть пустым.";
  if (trimmed.length < MIN_FIELD_LEN) {
    return `Минимум ${MIN_FIELD_LEN} символа после обрезки пробелов.`;
  }
  if (trimmed.length > MAX_FIELD_LEN) {
    return `Максимум ${MAX_FIELD_LEN} символов.`;
  }
  if (!hasLetter(trimmed)) {
    return "Должна быть хотя бы одна буква (не только цифры и символы).";
  }
  return null;
}

function checkWarningsArtist(name: string): string[] {
  const t = name.trim();
  if (!t) return [];
  const w: string[] = [];
  if (CAPS_RUN.test(t)) w.push("Избегайте длинных фрагментов В ВЕРХНЕМ РЕГИСТРЕ в имени артиста.");
  if (FORBIDDEN_SYMBOLS.test(t) || MULTI_BANG.test(t) || EMOJI.test(t)) {
    w.push("Уберите спецсимволы ($, @), три «!» подряд и эмодзи из имени артиста.");
  }
  if (PROD_BY.test(t)) w.push('Не указывайте в имени артиста слова вроде «Prod. by» / «Produced by».');
  return w;
}

function checkWarningsTitle(title: string, opts: { allowOriginalMix?: boolean }): string[] {
  const t = title.trim();
  if (!t) return [];
  const w: string[] = [];
  if (CAPS_RUN.test(t)) w.push("Избегайте длинных фрагментов В ВЕРХНЕМ РЕГИСТРЕ в названии.");
  if (FORBIDDEN_SYMBOLS.test(t) || MULTI_BANG.test(t) || EMOJI.test(t)) {
    w.push("Уберите спецсимволы ($, @), три «!» подряд и эмодзи из названия.");
  }
  if (TRACK_ONE.test(t)) w.push('Не используйте шаблоны вроде «Track 1» в названии.');
  if (!opts.allowOriginalMix && ORIGINAL_MIX.test(t)) {
    w.push('Формулировку «Original Mix» оставьте только для ремиксов (если это не ремикс — уберите).');
  }
  return w;
}

function collectCriticalForString(value: string, label: string): string[] {
  const t = value.trim();
  const c = checkCriticalContent(t);
  return c ? [`${label}: ${c}`] : [];
}

/**
 * Полная проверка: критические нарушения для сервера, предупреждения — через {@link getMetadataWarnings}.
 */
export function validateMetadata(data: ReleaseMetadata): MetadataValidationResult {
  const critical: string[] = [];

  for (let i = 0; i < data.artists.length; i += 1) {
    const name = data.artists[i]?.name ?? "";
    critical.push(...collectCriticalForString(name, `Артист ${i + 1}`));
  }

  critical.push(...collectCriticalForString(data.releaseTitle, "Название релиза"));

  const tracks = data.trackTitles ?? [];
  for (let i = 0; i < tracks.length; i += 1) {
    const title = tracks[i] ?? "";
    critical.push(...collectCriticalForString(title, `Трек ${i + 1}`));
  }

  return {
    isValid: critical.length === 0,
    errors: critical
  };
}

/**
 * Мягкие замечания (DSP) — не блокируют кнопку «Далее» на клиенте.
 */
export function getMetadataWarnings(data: ReleaseMetadata): string[] {
  const out: string[] = [];
  for (let i = 0; i < data.artists.length; i += 1) {
    out.push(...checkWarningsArtist(data.artists[i]?.name ?? ""));
  }
  out.push(...checkWarningsTitle(data.releaseTitle, { allowOriginalMix: false }));

  const tracks = data.trackTitles ?? [];
  for (let i = 0; i < tracks.length; i += 1) {
    const title = tracks[i] ?? "";
    out.push(
      ...checkWarningsTitle(title, { allowOriginalMix: /remix|ремикс/i.test(title) }).map(
        (m) => `Трек ${i + 1}: ${m}`
      )
    );
  }
  return [...new Set(out)];
}

export type MetadataFieldWarningFlags = {
  releaseTitle: boolean;
  artists: boolean[];
  trackTitles: boolean[];
};

/** Для жёлтой подсветки полей без блокировки сабмита. */
export function getMetadataFieldWarningFlags(data: ReleaseMetadata): MetadataFieldWarningFlags {
  const artists = data.artists.map((a) => checkWarningsArtist(a.name).length > 0);
  const releaseTitle = checkWarningsTitle(data.releaseTitle, { allowOriginalMix: false }).length > 0;
  const trackTitles = (data.trackTitles ?? []).map(
    (t) => checkWarningsTitle(t, { allowOriginalMix: /remix|ремикс/i.test(t) }).length > 0
  );
  return { releaseTitle, artists, trackTitles };
}
