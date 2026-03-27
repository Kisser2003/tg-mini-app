/** Поля мастера создания релиза (как в Lovable ReleaseWizard), 16px — без зума iOS. */
export const WIZARD_INPUT_CLASS =
  "min-h-[56px] w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-3.5 text-[16px] leading-normal text-white/90 outline-none transition-all duration-200 placeholder:text-white/20 focus:bg-white/[0.06] focus:ring-1 focus:ring-[#818cf8]/40 focus:ring-offset-0";

/** Подпись поля в мастере (uppercase, плотный трекинг). */
export const WIZARD_FIELD_LABEL_CLASS =
  "text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25";

/**
 * Единая «стеклянная» оболочка полей: симметричные отступы, фокус через ring (без скачка ширины border).
 */
export const GLASS_FIELD_BASE =
  "min-h-[56px] w-full rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-3.5 text-[16px] leading-normal text-white/90 outline-none transition-all duration-200 placeholder:text-white/20 focus:bg-white/[0.06] focus:ring-1 focus:ring-[#818cf8]/40 focus:ring-offset-0";

/** Обёртка для type=date: flex + фокус на контейнере */
export const GLASS_DATE_WRAP_BASE =
  "flex w-full min-h-[56px] items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] py-3 pl-4 pr-4 transition-all duration-200 focus-within:bg-white/[0.06] focus-within:ring-1 focus-within:ring-[#818cf8]/40 focus-within:ring-offset-0";

export const GLASS_FIELD_ERROR_STRONG =
  "border-red-500/45 ring-1 ring-red-500/30 focus:border-red-400/55 focus:ring-2 focus:ring-red-400/25";

export const GLASS_FIELD_ERROR_SOFT =
  "border-red-500/30 ring-1 ring-red-500/15 focus:border-red-400/45 focus:ring-2 focus:ring-red-400/20";

export const GLASS_DATE_WRAP_ERROR_STRONG =
  "border-red-500/45 ring-1 ring-red-500/30 focus-within:border-red-400/55 focus-within:ring-2 focus-within:ring-red-400/25";

export const GLASS_DATE_WRAP_ERROR_SOFT =
  "border-red-500/30 ring-1 ring-red-500/15 focus-within:border-red-400/45 focus-within:ring-2 focus-within:ring-red-400/20";
