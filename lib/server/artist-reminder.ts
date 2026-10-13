import { getReleaseDisplayTitle, type ReleaseRecord } from "@/repositories/releases/types";
import { escapeHtml } from "@/lib/telegram-bot.server";

/** Текст напоминания в бот: релиз начат, но не отправлен. */
export function buildReminderText(record: Pick<ReleaseRecord, "status"> & Partial<ReleaseRecord>): string {
  const titleRaw = getReleaseDisplayTitle(record as ReleaseRecord);
  const title = escapeHtml(titleRaw.length > 0 ? titleRaw : "релиз");
  const next =
    record.status === "pending"
      ? "Файлы уже загружены — осталось открыть релиз и нажать «Отправить на проверку»."
      : "Черновик сохранён — открой приложение и допиши релиз.";
  return `🎵 <b>Релиз «${title}» ещё не отправлен на проверку.</b>\n\n${next}`;
}
