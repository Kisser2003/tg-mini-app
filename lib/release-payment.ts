/**
 * Оплата релиза. Деньги принимает студия (Денис); подтверждает он кнопкой в боте
 * (см. lib/server/payment-confirm.ts), админ может поправить статус в админке.
 * Клиент статус не меняет: колонки защищены триггером в БД.
 */

export const PAYMENT_STATUSES = ["awaiting", "paid", "unpaid", "not_client"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Ответы студии кнопками в боте. */
export const STUDIO_ANSWERS = ["paid", "unpaid", "not_client"] as const;
export type StudioAnswer = (typeof STUDIO_ANSWERS)[number];

/** Кто поменял статус: студия кнопкой в боте или админ. */
export type PaymentActor = "studio" | "admin";

/** Как называем подтверждающего в интерфейсе админки. */
export const STUDIO_CONFIRMER_NAME = "Денис";

export function parsePaymentStatus(raw: unknown): PaymentStatus | null {
  return typeof raw === "string" && (PAYMENT_STATUSES as readonly string[]).includes(raw)
    ? (raw as PaymentStatus)
    : null;
}

export function isPaymentConfirmed(raw: unknown): boolean {
  return parsePaymentStatus(raw) === "paid";
}

export type PaymentTone = "done" | "wait" | "problem" | "muted";

/** Короткая строка для карточки очереди и панели оплаты. */
export function describePayment(raw: unknown): { label: string; tone: PaymentTone } {
  switch (parsePaymentStatus(raw)) {
    case "paid":
      return { label: "оплачено", tone: "done" };
    case "unpaid":
      return { label: "не оплачено", tone: "problem" };
    case "not_client":
      return { label: "не клиент студии", tone: "problem" };
    case "awaiting":
      return { label: `оплата: ждём ответ ${STUDIO_CONFIRMER_NAME}а`, tone: "wait" };
    default:
      return { label: "оплата не отмечена", tone: "muted" };
  }
}

/** «Денис · 14 окт, 12:30» — кто и когда последним менял статус. */
export function describePaymentUpdate(
  by: string | null | undefined,
  at: string | null | undefined
): string | null {
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  const when = d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow"
  });
  const who = by === "studio" ? STUDIO_CONFIRMER_NAME : by === "admin" ? "админ" : null;
  return who ? `${who} · ${when}` : when;
}
