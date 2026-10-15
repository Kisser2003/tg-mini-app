/**
 * Оплата релиза. Деньги принимает админ; на каждый отправленный релиз бот спрашивает его «Оплатил?»
 * кнопками (см. lib/server/payment-confirm.ts), статус можно поправить и в админке.
 * Клиент статус не меняет: колонки защищены триггером в БД.
 */

export const PAYMENT_STATUSES = ["awaiting", "paid", "unpaid", "not_client"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Ответы кнопками в боте. */
export const PAYMENT_ANSWERS = ["paid", "unpaid", "not_client"] as const;
export type PaymentAnswer = (typeof PAYMENT_ANSWERS)[number];

/** Кто поменял статус. `studio` — только старые записи, когда отвечал Денис; сейчас всегда `admin`. */
export type PaymentActor = "studio" | "admin";

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
      return { label: "оплата: ждём подтверждения", tone: "wait" };
    default:
      return { label: "оплата не отмечена", tone: "muted" };
  }
}

/** «админ · 14 окт, 12:30» — кто и когда последним менял статус. */
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
  const who = by === "studio" ? "студия" : by === "admin" ? "админ" : null;
  return who ? `${who} · ${when}` : when;
}
