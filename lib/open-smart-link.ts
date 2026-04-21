import { getTelegramWebApp } from "@/lib/telegram";

/**
 * Открывает внешнюю ссылку: в TMA предпочтительно `Telegram.WebApp.openLink`, иначе `window.open`.
 */
export function openSmartLink(url: string): void {
  const trimmed = url.trim();
  if (!trimmed || typeof window === "undefined") return;

  const webApp = getTelegramWebApp();
  if (webApp?.openLink) {
    try {
      webApp.openLink(trimmed);
      return;
    } catch {
      /* fallback */
    }
  }

  window.open(trimmed, "_blank", "noopener,noreferrer");
}
