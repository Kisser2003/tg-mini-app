/**
 * Поля мастера создания релиза (OMF 2026): плоское поле на графитовой поверхности,
 * фокус — ультрамариновая рамка. 16px — без зума iOS.
 */
const FIELD =
  "min-h-[52px] w-full rounded-control border border-omf-line bg-omf-surface px-4 py-3 text-[16px] leading-normal text-omf-ink outline-none transition-colors duration-150 placeholder:text-omf-faint focus:border-omf-ultra focus:bg-omf-surface";

export const WIZARD_INPUT_CLASS = FIELD;

/** Подпись поля: обычный регистр, графит. */
export const WIZARD_FIELD_LABEL_CLASS = "text-[13px] font-normal text-omf-graphite";

export const GLASS_FIELD_BASE = FIELD;

/** Обёртка для type=date: flex + фокус на контейнере */
export const GLASS_DATE_WRAP_BASE =
  "flex w-full min-h-[52px] items-center justify-between gap-3 rounded-control border border-omf-line bg-omf-surface py-3 pl-4 pr-4 transition-colors duration-150 focus-within:border-omf-ultra";

export const GLASS_FIELD_ERROR_STRONG = "border-omf-red focus:border-omf-red";

export const GLASS_FIELD_ERROR_SOFT = "border-omf-red focus:border-omf-red";

export const GLASS_DATE_WRAP_ERROR_STRONG = "border-omf-red focus-within:border-omf-red";

export const GLASS_DATE_WRAP_ERROR_SOFT = "border-omf-red focus-within:border-omf-red";
