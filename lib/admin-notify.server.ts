/**
 * Уведомления админу в Telegram (новый релиз на модерации, ошибки).
 * Ошибки наружу не пробрасываются: уведомление не должно ломать основной сценарий.
 */

import { getExpectedAdminTelegramId } from "@/lib/admin";
import { escapeHtml } from "@/lib/telegram-bot.server";
import { sendTelegramNotification } from "@/lib/telegram-notifications";

let lastErrorNoticeAt = 0;
const ERROR_NOTICE_COOLDOWN_MS = 2 * 60 * 1000;

async function sendToAdmin(text: string): Promise<void> {
  try {
    await sendTelegramNotification(String(getExpectedAdminTelegramId()), text);
  } catch (e) {
    console.error("[admin-notify]", e);
  }
}

export async function notifyAdminReleaseSubmitted(params: {
  title: string;
  artist: string;
  telegramId?: string | number | null;
}): Promise<void> {
  const who = params.telegramId ? ` (tg ${escapeHtml(String(params.telegramId))})` : "";
  await sendToAdmin(
    `🆕 <b>Новый релиз на модерации</b>\n\n` +
      `«${escapeHtml(params.title || "без названия")}» — ${escapeHtml(params.artist || "—")}${who}\n\n` +
      `Открой админку в мини-приложении, чтобы проверить.`
  );
}

/** Не чаще одного сообщения об ошибке в 2 минуты (защита от спама и циклов ошибок). */
export async function notifyAdminError(where: string, message: string): Promise<void> {
  const now = Date.now();
  if (now - lastErrorNoticeAt < ERROR_NOTICE_COOLDOWN_MS) return;
  lastErrorNoticeAt = now;
  await sendToAdmin(
    `⚠️ <b>Ошибка в приложении</b>\n\n<b>${escapeHtml(where.slice(0, 120))}</b>\n${escapeHtml(message.slice(0, 500))}`
  );
}
