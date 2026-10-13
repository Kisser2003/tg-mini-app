import { escapeHtml } from "@/lib/telegram-bot.server";
import { DSP_REVIEW_DAYS_TEXT } from "@/lib/release-next-step";

function safeTitle(title: string): string {
  const t = title.trim();
  return escapeHtml(t.length > 0 ? t : "релиз");
}

/** Модератор принял релиз и отправил дистрибьюторам; ссылки ещё нет. */
export function acceptedMessage(title: string): string {
  return (
    `✅ <b>Релиз «${safeTitle(title)}» принят!</b>\n\n` +
    `Мы отправили его на площадки. Их модерация обычно занимает ${DSP_REVIEW_DAYS_TEXT} — ` +
    `когда пройдёт, пришлём сюда ссылку на пресейв.`
  );
}

/** Ссылка на пресейв готова (сразу при приёме или позже, после модерации площадок). */
export function linkReadyMessage(title: string, link: string, opts: { acceptedNow: boolean }): string {
  const head = opts.acceptedNow
    ? `✅ <b>Релиз «${safeTitle(title)}» принят и уже прошёл модерацию площадок.</b>`
    : `🔗 <b>Релиз «${safeTitle(title)}» прошёл модерацию площадок.</b>`;
  return `${head}\n\nСсылка на пресейв: <a href="${escapeHtml(link)}">открыть</a>`;
}
