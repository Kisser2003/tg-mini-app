/**
 * Высокоуровневые уведомления артисту через Telegram Bot API.
 * Токен только на сервере; ошибки не пробрасываются наружу.
 */

import { sendTelegramBotMessage } from "@/lib/telegram-bot.server";

export async function sendTelegramNotification(chatId: string, message: string): Promise<void> {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
      console.warn("[sendTelegramNotification] TELEGRAM_BOT_TOKEN is not set, skip");
      return;
    }
    const id = Number(String(chatId).trim());
    if (!Number.isFinite(id) || id <= 0) {
      console.error("[sendTelegramNotification] invalid chatId:", chatId);
      return;
    }
    const result = await sendTelegramBotMessage({
      chatId: id,
      text: message,
      parseMode: "HTML"
    });
    if (!result.ok) {
      console.error("[sendTelegramNotification] Telegram API:", result.error);
    }
  } catch (e) {
    console.error("[sendTelegramNotification]", e);
  }
}
