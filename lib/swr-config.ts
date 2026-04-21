/** Единые опции SWR для списков (библиотека, админ). */
export const SWR_LIST_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnMount: true,
  dedupingInterval: 10_000
} as const;
