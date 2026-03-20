/**
 * Единая «стеклянная» оболочка полей: симметричные отступы, фокус через ring (без скачка ширины border).
 */
export const GLASS_FIELD_BASE =
  "min-h-[56px] w-full rounded-[18px] border border-white/[0.08] bg-black/40 px-4 py-3 text-[16px] leading-normal text-white outline-none transition-[background-color,box-shadow,border-color] duration-200 focus:bg-black/60 focus:ring-2 focus:ring-violet-500/25 focus:ring-offset-0";

/** Обёртка для type=date: flex + фокус на контейнере */
export const GLASS_DATE_WRAP_BASE =
  "flex w-full min-h-[56px] items-center justify-between gap-3 rounded-[18px] border border-white/[0.08] bg-black/40 py-3 pl-4 pr-4 transition-[background-color,box-shadow,border-color] duration-200 focus-within:bg-black/60 focus-within:ring-2 focus-within:ring-violet-500/25 focus-within:ring-offset-0";

export const GLASS_FIELD_ERROR_STRONG =
  "border-red-500/45 ring-1 ring-red-500/30 focus:border-red-400/55 focus:ring-2 focus:ring-red-400/25";

export const GLASS_FIELD_ERROR_SOFT =
  "border-red-500/30 ring-1 ring-red-500/15 focus:border-red-400/45 focus:ring-2 focus:ring-red-400/20";

export const GLASS_DATE_WRAP_ERROR_STRONG =
  "border-red-500/45 ring-1 ring-red-500/30 focus-within:border-red-400/55 focus-within:ring-2 focus-within:ring-red-400/25";

export const GLASS_DATE_WRAP_ERROR_SOFT =
  "border-red-500/30 ring-1 ring-red-500/15 focus-within:border-red-400/45 focus-within:ring-2 focus-within:ring-red-400/20";
