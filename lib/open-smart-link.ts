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

/** Открывает личку с пользователем: в TMA через `openTelegramLink`, иначе обычной ссылкой t.me. */
export function openTelegramChat(username: string): void {
  const handle = username.trim().replace(/^@/, "");
  if (!handle || typeof window === "undefined") return;
  const url = `https://t.me/${encodeURIComponent(handle)}`;

  const webApp = getTelegramWebApp();
  if (webApp?.openTelegramLink) {
    try {
      webApp.openTelegramLink(url);
      return;
    } catch {
      /* fallback */
    }
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
