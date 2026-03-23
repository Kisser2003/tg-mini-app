/**
 * Держит экран включённым во время долгих операций (мобильные браузеры / Telegram WebView).
 */
export async function requestScreenWakeLock(): Promise<{ release: () => void } | null> {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
    return null;
  }
  try {
    const s = await navigator.wakeLock.request("screen");
    return { release: () => void s.release() };
  } catch {
    return null;
  }
}

export function releaseWakeLock(sentinel: { release: () => void } | null): void {
  if (!sentinel) return;
  try {
    sentinel.release();
  } catch {
    /* ignore */
  }
}
