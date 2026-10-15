/** Реферальная программа: суммы и формат ссылки (общие для клиента и сервера). */

/** Скидка другу на первый релиз. */
export const REFEREE_DISCOUNT_RUB = 500;
/** Бонус пригласившему за каждого друга, оплатившего первый релиз: админ переводит вручную. */
export const REFERRER_REWARD_RUB = 500;

const START_PARAM_PREFIX = "ref_";
const CODE_RE = /^[A-Z0-9]{6,12}$/;

/** `ref_K7X2QP` из start_param → `K7X2QP`; всё остальное → null. */
export function parseReferralStartParam(raw: string | null | undefined): string | null {
  const v = raw?.trim() ?? "";
  if (!v.toLowerCase().startsWith(START_PARAM_PREFIX)) return null;
  const code = v.slice(START_PARAM_PREFIX.length).toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

export function referralStartParam(code: string): string {
  return `${START_PARAM_PREFIX}${code}`;
}

export function formatRub(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} ₽`;
}

/** Ответ GET /api/referral/me. */
export type ReferralSummary = {
  code: string;
  /** null — не задан TELEGRAM_MINI_APP_URL. */
  link: string | null;
  invited: number;
  paid: number;
  /** Бонусы, которые ещё не выплатили. */
  available: number;
  /** Пришёл по приглашению и ещё не оплатил первый релиз — скидка ждёт. */
  hasPendingDiscount: boolean;
};
