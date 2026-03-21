/** Язык исполнения (DSP / модерация). */
export const PERFORMANCE_LANGUAGE_VALUES = ["RU", "EN", "Instrumental", "UA", "KZ", "Other"] as const;

export type PerformanceLanguage = (typeof PERFORMANCE_LANGUAGE_VALUES)[number];

export const PERFORMANCE_LANGUAGE_LABELS: Record<PerformanceLanguage, string> = {
  RU: "Русский",
  EN: "English",
  Instrumental: "Инструментал",
  UA: "Українська",
  KZ: "Қазақша",
  Other: "Другой"
};

export function parsePerformanceLanguage(raw: unknown): PerformanceLanguage {
  if (
    typeof raw === "string" &&
    (PERFORMANCE_LANGUAGE_VALUES as readonly string[]).includes(raw)
  ) {
    return raw as PerformanceLanguage;
  }
  return "RU";
}
