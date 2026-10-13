import { normalizeReleaseStatus } from "@/lib/release-status";

/** Обещанный артисту срок проверки (тот же, что в тексте после отправки). */
export const MODERATION_SLA_HOURS = 24;

export type NextStepKind =
  | "finish_draft"
  | "submit"
  | "fix"
  | "waiting"
  | "waiting_long"
  | "approved_link"
  | "approved_no_link"
  | "unknown";

/** Цвет строки: action — нужен шаг артиста, problem — вернули, wait — ждём, done — готово. */
export type NextStepTone = "action" | "problem" | "wait" | "warn" | "done" | "muted";

export type ReleaseNextStep = {
  kind: NextStepKind;
  tone: NextStepTone;
  /** Короткая строка на плитке библиотеки (влезает в ~170px). */
  cardLine: string;
  /** Заголовок блока статуса на экране релиза. */
  title: string;
  body: string;
  /** Артисту нужно что-то сделать самому. */
  needsAction: boolean;
};

export type NextStepInput = {
  status: string | null | undefined;
  smartLink?: string | null;
  /** Когда релиз ушёл на проверку (ISO), если известно. */
  submittedAt?: string | null;
  /** Решение придёт сообщением в Telegram (у веб-аккаунтов без Telegram — нет). */
  notifiesInTelegram?: boolean;
};

/** «меньше часа», «3 ч», «2 дн». */
export function formatWaitDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours < 1) return "меньше часа";
  if (hours < 24) return `${Math.floor(hours)} ч`;
  return `${Math.floor(hours / 24)} дн`;
}

function waitedHours(submittedAt: string | null | undefined, now: Date): number | null {
  if (!submittedAt) return null;
  const t = new Date(submittedAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, (now.getTime() - t) / 36e5);
}

/** Где релиз и что делать дальше — одна формулировка для плитки и экрана релиза. */
export function getReleaseNextStep(input: NextStepInput, now: Date = new Date()): ReleaseNextStep {
  const status = normalizeReleaseStatus(input.status);
  const link = input.smartLink?.trim() ?? "";

  switch (status) {
    case "draft":
      return {
        kind: "finish_draft",
        tone: "action",
        cardLine: "Допиши и отправь",
        title: "Черновик",
        body: "Релиз ещё не отправлен. Продолжи с того места, где остановился, и отправь на проверку.",
        needsAction: true
      };
    case "pending":
      return {
        kind: "submit",
        tone: "action",
        cardLine: "Осталось отправить",
        title: "Не отправлен",
        body: "Файлы загружены, но релиз ещё не ушёл на проверку. Открой его и нажми «Отправить на проверку».",
        needsAction: true
      };
    case "failed":
      return {
        kind: "fix",
        tone: "problem",
        cardLine: "Исправь замечания",
        title: "Вернули на доработку",
        body: "Модератор вернул релиз. Исправь замечания и отправь снова — файлы уже загружены.",
        needsAction: true
      };
    case "processing": {
      const hours = waitedHours(input.submittedAt, now);
      const notify = input.notifiesInTelegram
        ? "Когда будет решение, статус обновится здесь и придёт сообщение в Telegram."
        : "Когда будет решение, статус обновится здесь.";
      if (hours != null && hours >= MODERATION_SLA_HOURS) {
        return {
          kind: "waiting_long",
          tone: "warn",
          cardLine: "Дольше обычного",
          title: "Проверка затянулась",
          body: `Релиз на проверке ${formatWaitDuration(hours)}, обычно это до ${MODERATION_SLA_HOURS} часов. Напиши в поддержку в разделе «Помощь» — посмотрим, что случилось.`,
          needsAction: false
        };
      }
      return {
        kind: "waiting",
        tone: "wait",
        cardLine: hours != null ? `На проверке ${formatWaitDuration(hours)}` : `Проверка до ${MODERATION_SLA_HOURS} ч`,
        title: "На проверке",
        body: `${hours != null ? `Отправлен ${formatWaitDuration(hours)} назад. ` : ""}Модератор проверяет паспорт, обложку и аудио, обычно до ${MODERATION_SLA_HOURS} часов. ${notify}`,
        needsAction: false
      };
    }
    case "ready":
      return link
        ? {
            kind: "approved_link",
            tone: "done",
            cardLine: "Ссылка готова",
            title: "Одобрен",
            body: "Релиз прошёл проверку и отправлен на площадки. Ссылка на все площадки — ниже.",
            needsAction: false
          }
        : {
            kind: "approved_no_link",
            tone: "done",
            cardLine: "Одобрен · ссылка скоро",
            title: "Одобрен",
            body: "Релиз прошёл проверку и отправлен на площадки. Ссылка появится, когда площадки его опубликуют.",
            needsAction: false
          };
    default:
      return {
        kind: "unknown",
        tone: "muted",
        cardLine: "",
        title: "Статус уточняется",
        body: "Не получилось определить статус релиза. Обнови страницу чуть позже.",
        needsAction: false
      };
  }
}

export const NEXT_STEP_TONE_CLASS: Record<NextStepTone, string> = {
  action: "text-omf-ink font-medium",
  problem: "text-omf-red font-medium",
  wait: "text-omf-graphite",
  warn: "text-omf-yellow",
  done: "text-omf-green",
  muted: "text-omf-graphite"
};
