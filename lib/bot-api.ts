import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/api/get-telegram-init-data-from-request";
import { getTelegramWebApp } from "@/lib/telegram";
import type { ReleaseRecord } from "@/repositories/releases.repo";

/**
 * Название релиза в БД — поле `track_name` (в UI/уведомлениях — как название релиза).
 * Отправка через защищённый API; токен бота только на сервере.
 */
export async function sendApprovalNotification(release: ReleaseRecord): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  const initData = getTelegramWebApp()?.initData;
  if (initData) {
    headers[TELEGRAM_INIT_DATA_HEADER] = initData;
  }

  const res = await fetch("/api/notify-release-approved", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({
      targetUserId: release.user_id,
      releaseName: release.track_name,
      releaseDate: release.release_date
    })
  });

  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };

  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }

  if (!data.ok) {
    // например TELEGRAM_BOT_TOKEN не задан — не считаем это сбоем смены статуса
    return;
  }
}
