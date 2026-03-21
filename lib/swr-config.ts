/** Единые опции SWR для списков (библиотека, кошелёк, админ). */
export const SWR_LIST_OPTIONS = {
  revalidateOnFocus: false,
  dedupingInterval: 10_000
} as const;
