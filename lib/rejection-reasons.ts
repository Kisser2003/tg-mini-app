import type { FaqTopicKey } from "@/lib/faq-topics";

/**
 * Причины возврата релиза. `message` уходит артисту (бот + карточка релиза),
 * `hint` — короткое «что сделать» для артиста, `faqTopic` — раздел «Помощи».
 */
export const REJECT_REASONS = [
  {
    key: "caps",
    label: "Верхний регистр",
    message:
      "Пожалуйста, поправьте типографику: избегайте длинных фрагментов В ВЕРХНЕМ РЕГИСТРЕ в названиях и именах.",
    hint: "Напиши название и имена обычными буквами, без сплошного капса.",
    faqTopic: "metadata"
  },
  {
    key: "quality",
    label: "Качество аудио",
    message:
      "К сожалению, качество записи не подходит для площадок: слышны шум, клиппинг или звук не совпадает с заявленным материалом.",
    hint: "Загрузи чистый мастер в WAV без шума и перегруза.",
    faqTopic: "audio"
  },
  {
    key: "copyright",
    label: "Авторские права",
    message:
      "Есть сомнения в правах на распространение. Пришлите, пожалуйста, подтверждающие материалы в поддержку.",
    hint: "Пришли в поддержку документы на бит или семплы.",
    faqTopic: null
  },
  {
    key: "title",
    label: "Название и имена",
    message:
      "Поправьте название релиза, треков или имя артиста: уберите эмодзи, лишние символы и промо-слова (например, «FREE DOWNLOAD»).",
    hint: "Убери из названий эмодзи, лишние символы и промо-слова.",
    faqTopic: "metadata"
  },
  {
    key: "explicit",
    label: "Метка explicit",
    message:
      "Метка explicit не соответствует содержанию: отметьте нецензурные треки или уберите метку, если мата нет.",
    hint: "Проверь отметку «мат» у каждого трека.",
    faqTopic: "metadata"
  },
  {
    key: "links",
    label: "Ссылки артиста",
    message: "Ссылки на профили артиста указаны неверно или не открываются. Проверьте и исправьте их.",
    hint: "Проверь ссылки на профили артиста: они должны открываться.",
    faqTopic: "metadata"
  },
  {
    key: "artwork",
    label: "Обложка",
    message:
      "Обложка не соответствует требованиям площадок: разрешение, читаемость текста или общее оформление.",
    hint: "Загрузи обложку 3000×3000 без ссылок, логотипов площадок и мелкого текста.",
    faqTopic: "cover"
  }
] as const satisfies readonly {
  key: string;
  label: string;
  message: string;
  hint: string;
  faqTopic: FaqTopicKey | null;
}[];

export type RejectReasonKey = (typeof REJECT_REASONS)[number]["key"];
export type RejectReason = (typeof REJECT_REASONS)[number];

export function findRejectReason(key: string): RejectReason | null {
  return REJECT_REASONS.find((r) => r.key === key) ?? null;
}

export const REJECTION_FALLBACK_TEXT =
  "Модератор не оставил комментарий. Напиши в поддержку в разделе «Помощь», чтобы узнать, что исправить.";

export type RejectionSummary = {
  /** Текст модератора (как пришёл в бот). */
  message: string;
  /** Распознанные пресеты: что исправить и где почитать. */
  reasons: RejectReason[];
  /** Модератор ничего не написал. */
  isFallback: boolean;
};

/** Сводка для экрана артиста: текст модератора + подсказки по ключам причин. */
export function describeRejection(input: {
  adminNotes?: string | null;
  errorMessage?: string | null;
  rejectionReasons?: readonly string[] | null;
}): RejectionSummary {
  const text = input.adminNotes?.trim() || input.errorMessage?.trim() || "";
  const seen = new Set<string>();
  const reasons: RejectReason[] = [];
  for (const key of input.rejectionReasons ?? []) {
    if (seen.has(key)) continue;
    seen.add(key);
    const r = findRejectReason(key);
    if (r) reasons.push(r);
  }
  return {
    message: text || REJECTION_FALLBACK_TEXT,
    reasons,
    isFallback: text.length === 0
  };
}

/** Ссылка на раздел «Помощи». */
export function faqTopicHref(topic: FaqTopicKey): string {
  return `/requirements?topic=${topic}`;
}
