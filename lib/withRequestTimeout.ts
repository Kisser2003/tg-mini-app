/**
 * Обрывает промис по таймауту (для fetcher'ов SWR и аналогов).
 */
export function withRequestTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  promise.catch(() => {});
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }) as Promise<T>;
}
