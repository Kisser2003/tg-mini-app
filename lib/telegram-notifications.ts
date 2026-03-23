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
    const trimmed = String(chatId).trim();
    /** Не приводим к Number — большие Telegram id и строковый chat_id должны уходить в API как есть. */
    if (!/^\d+$/.test(trimmed) || trimmed === "0") {
      console.error("[sendTelegramNotification] invalid chatId:", chatId);
      return;
    }
    const result = await sendTelegramBotMessage({
      chatId: trimmed,
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
