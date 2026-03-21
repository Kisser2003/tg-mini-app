/**
 * DSP-oriented проверки метаданных релиза (мягкие предупреждения на клиенте,
 * критические — блокируют submit-precheck на сервере).
 */

import type { ArtistLinksState } from "@/lib/artist-links";
import { mergeArtistLinksPartial } from "@/lib/artist-links";

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

const LINK_LABELS: Record<keyof ArtistLinksState, string> = {
  spotify: "Spotify",
  apple: "Apple Music",
  yandex: "Yandex Music",
  vk: "VK"
};

export type ReleaseMetadata = {
  primaryArtist: string;
  releaseTitle: string;
  /** Названия треков; если не переданы — проверяются только релиз и артист. */
  trackTitles?: string[];
  language?: string;
  /** Глобальные ссылки на карточки артиста (если заполнены — валидные URL). */
  releaseArtistLinks?: Partial<ArtistLinksState>;
};

export type MetadataValidationResult = {
  isValid: boolean;
  errors: string[];
};

function hasLetter(s: string): boolean {
  return /\p{L}/u.test(s);
}

function checkCriticalContent(trimmed: string): string | null {
  if (trimmed.length === 0) return "Пожалуйста, заполните это поле.";
  if (trimmed.length < MIN_FIELD_LEN) {
    return `Нужно минимум ${MIN_FIELD_LEN} символа (без лишних пробелов).`;
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

function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Ссылки на DSP: при непустом значении — должен быть валидный URL. Для submit-precheck. */
export function collectReleaseArtistLinkErrors(links: Partial<ArtistLinksState> | undefined): string[] {
  const merged = mergeArtistLinksPartial(links);
  const out: string[] = [];
  (Object.keys(LINK_LABELS) as (keyof ArtistLinksState)[]).forEach((k) => {
    const v = merged[k].trim();
    if (v.length === 0) return;
    if (!isValidHttpUrl(v)) {
      out.push(`${LINK_LABELS[k]}: укажите корректную ссылку (https://…).`);
    }
  });
  return out;
}

export function validateMetadata(data: ReleaseMetadata): MetadataValidationResult {
  const critical: string[] = [];

  critical.push(...collectCriticalForString(data.primaryArtist, "Артист"));
  critical.push(...collectCriticalForString(data.releaseTitle, "Название релиза"));

  const tracks = data.trackTitles ?? [];
  for (let i = 0; i < tracks.length; i += 1) {
    const title = tracks[i] ?? "";
    critical.push(...collectCriticalForString(title, `Трек ${i + 1}`));
  }

  const lang = data.language?.trim() ?? "";
  if (lang.length === 0) {
    critical.push("Выберите язык исполнения.");
  }

  /* Ссылки на профили необязательны на шаге паспорта; проверка URL — в submit-precheck. */

  return {
    isValid: critical.length === 0,
    errors: critical
  };
}

export function getMetadataWarnings(data: ReleaseMetadata): string[] {
  const out: string[] = [];
  out.push(...checkWarningsArtist(data.primaryArtist));
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
  primaryArtist: boolean;
  trackTitles: boolean[];
};

export function getMetadataFieldWarningFlags(data: ReleaseMetadata): MetadataFieldWarningFlags {
  const primaryArtist = checkWarningsArtist(data.primaryArtist).length > 0;
  const releaseTitle = checkWarningsTitle(data.releaseTitle, { allowOriginalMix: false }).length > 0;
  const trackTitles = (data.trackTitles ?? []).map(
    (t) => checkWarningsTitle(t, { allowOriginalMix: /remix|ремикс/i.test(t) }).length > 0
  );
  return { releaseTitle, primaryArtist, trackTitles };
}
