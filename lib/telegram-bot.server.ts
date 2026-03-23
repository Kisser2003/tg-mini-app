/**
 * Server-only Telegram Bot API helpers (Route Handlers, Server Actions).
 * Client WebApp code lives in lib/telegram.ts.
 */

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type SendTelegramBotMessageOptions = {
  /** Telegram принимает и число, и строку; из БД bigint часто сериализуется как string. */
  chatId: number | string;
  text: string;
  parseMode?: "HTML" | "MarkdownV2";
  disableWebPagePreview?: boolean;
};

export type SendTelegramBotMessageResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * sendMessage via Telegram Bot API. Requires TELEGRAM_BOT_TOKEN on the server.
 */
export async function sendTelegramBotMessage(
  options: SendTelegramBotMessageOptions
): Promise<SendTelegramBotMessageResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN is not set" };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: options.chatId,
        text: options.text,
        parse_mode: options.parseMode ?? "HTML",
        disable_web_page_preview: options.disableWebPagePreview ?? true
      })
    });

    const data = (await res.json()) as { ok?: boolean; description?: string };

    if (!data.ok) {
      return {
        ok: false,
        error: data.description ?? `Telegram API HTTP ${res.status}`
      };
    }

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}
