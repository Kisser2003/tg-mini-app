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
  },
  {
    key: "unpaid",
    label: "Не оплачен",
    message:
      "Релиз не оплачен, и связаться с вами не получилось. Выпуск платный: согласуйте стоимость и оплату со студией, после этого отправьте релиз заново.",
    hint: "Свяжись со студией, оплати выпуск и отправь релиз заново.",
    faqTopic: null
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

/** Лимит текста причины в API `update-release-status`. */
export const REJECTION_COMMENT_MAX = 2000;
/** Своя причина короче — скорее случайный ввод. */
export const REJECTION_CUSTOM_MIN = 5;

/**
 * Текст и ключи для возврата релиза: выбранные пресеты (в порядке списка) + своя причина.
 * `null` — причины нет, возвращать нельзя.
 */
export function buildRejection(
  selectedKeys: readonly string[],
  customText: string
): { comment: string; reasonKeys: string[] } | null {
  const selected = REJECT_REASONS.filter((r) => selectedKeys.includes(r.key));
  const custom = customText.trim();
  const hasCustom = custom.length >= REJECTION_CUSTOM_MIN;
  if (selected.length === 0 && !hasCustom) return null;

  const parts: string[] = selected.map((r) => r.message);
  if (hasCustom) parts.push(custom);
  const comment =
    parts.length === 1 ? parts[0] : parts.map((p) => `• ${p}`).join("\n");

  return {
    comment: comment.slice(0, REJECTION_COMMENT_MAX),
    reasonKeys: [...selected.map((r) => r.key), ...(hasCustom ? ["custom"] : [])]
  };
}

/**
 * Для модератора: релиз уже возвращали и артист прислал исправление.
 * `admin_notes` и `rejection_reasons` сохраняются при повторной отправке — это прошлое замечание.
 */
export function describePreviousRejection(release: {
  status?: string | null;
  rejection_count?: number | null;
  rejection_reasons?: readonly string[] | null;
  admin_notes?: string | null;
}): { count: number; summary: string } | null {
  const count = Number(release.rejection_count ?? 0);
  if (!Number.isFinite(count) || count <= 0) return null;
  if (release.status !== "processing" && release.status !== "review") return null;
  const labels = (release.rejection_reasons ?? [])
    .map((k) => findRejectReason(k)?.label)
    .filter((l): l is RejectReason["label"] => Boolean(l));
  const notes = release.admin_notes?.trim() ?? "";
  const summary =
    labels.length > 0 ? labels.join(", ") : notes.length > 120 ? `${notes.slice(0, 117)}…` : notes;
  return { count, summary };
}

/** Для истории модерации: что получил артист — причины возврата или ссылку. */
export function describeHistoryDecision(release: {
  status?: string | null;
  smart_link?: string | null;
  rejection_reasons?: readonly string[] | null;
  admin_notes?: string | null;
  error_message?: string | null;
}): string | null {
  if (release.status === "ready") {
    const link = release.smart_link?.trim();
    return link ? `Ссылка: ${link.replace(/^https?:\/\//, "")}` : "Принят, ждёт ссылку";
  }
  if (release.status === "failed") {
    const labels = (release.rejection_reasons ?? [])
      .map((k) => findRejectReason(k)?.label)
      .filter(Boolean);
    if (labels.length > 0) return `Вернули: ${labels.join(", ")}`;
    const text = release.admin_notes?.trim() || release.error_message?.trim();
    return text ? `Вернули: ${text}` : "Вернули без комментария";
  }
  return null;
}
