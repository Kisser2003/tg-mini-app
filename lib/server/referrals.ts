import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MAX_REWARDS_PER_RELEASE,
  REFEREE_DISCOUNT_RUB,
  REFERRER_REWARD_RUB,
  formatRub,
  referralStartParam,
  type ReferralSummary
} from "@/lib/referral";
import type { PaymentStatus } from "@/lib/release-payment";
import { artistTelegramId, notifyArtist } from "@/lib/server/artist-notify";

/**
 * Реферальная программа. Друг открывает мини-приложение по ссылке `…?startapp=ref_<code>`,
 * его telegram_id привязывается к пригласившему (только если у него ещё нет релизов).
 * Скидку другу и бонус пригласившему видит Денис в сообщении «Оплатил?»; учёт — по кнопке «Оплатил».
 */

type ReleaseRef = { id: string; telegram_id?: unknown; payment_status?: string | null };

/**
 * Состояние — по `paid_at` / `reward_redeemed_at`: id релизов обнуляются при удалении релиза
 * (ON DELETE SET NULL), и тогда скидка или бонус «воскресли» бы второй раз.
 */
type ReferralRow = {
  referee_telegram_id: string;
  referrer_telegram_id: string;
  paid_release_id: string | null;
  paid_at: string | null;
  reward_redeemed_release_id: string | null;
  reward_redeemed_at: string | null;
};

/** Без 0/O/1/I — код читают глазами. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const UNIQUE_VIOLATION = "23505";

function randomCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

/** Ссылка на мини-приложение с кодом; TELEGRAM_MINI_APP_URL — например https://t.me/omf_bot/app. */
export function referralLink(code: string): string | null {
  const base = process.env.TELEGRAM_MINI_APP_URL?.trim().replace(/\/+$/, "") ?? "";
  if (!/^https:\/\/t\.me\/[A-Za-z0-9_]{4,64}(\/[A-Za-z0-9_]{1,64})?$/.test(base)) return null;
  return `${base}?startapp=${referralStartParam(code)}`;
}

export async function getOrCreateReferralCode(admin: SupabaseClient, telegramId: string): Promise<string | null> {
  const load = async () => {
    const { data, error } = await admin
      .from("referral_codes")
      .select("code")
      .eq("telegram_id", telegramId)
      .maybeSingle();
    if (error) console.error("[referrals] load code:", error.message);
    return (data as { code?: string } | null)?.code ?? null;
  };

  const existing = await load();
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { error } = await admin.from("referral_codes").insert({ telegram_id: telegramId, code });
    if (!error) return code;
    if (error.code !== UNIQUE_VIOLATION) {
      console.error("[referrals] create code:", error.message);
      return null;
    }
    // Конфликт: либо код занят (пробуем другой), либо параллельный запрос уже создал код этому пользователю.
    const raced = await load();
    if (raced) return raced;
  }
  return null;
}

export type AttributeResult = "attributed" | "already" | "not_new" | "self" | "unknown_code" | "error";

/** Привязать друга к пригласившему. Только новые пользователи: ни одного релиза, даже черновика. */
export async function attributeReferral(
  admin: SupabaseClient,
  refereeTelegramId: string,
  code: string
): Promise<AttributeResult> {
  const { data: owner, error: ownerErr } = await admin
    .from("referral_codes")
    .select("telegram_id")
    .eq("code", code)
    .maybeSingle();
  if (ownerErr) {
    console.error("[referrals] code lookup:", ownerErr.message);
    return "error";
  }
  const referrer = (owner as { telegram_id?: string } | null)?.telegram_id;
  if (!referrer) return "unknown_code";
  if (referrer === refereeTelegramId) return "self";

  const { data: existing, error: existingErr } = await admin
    .from("referrals")
    .select("referee_telegram_id")
    .eq("referee_telegram_id", refereeTelegramId)
    .maybeSingle();
  if (existingErr) {
    console.error("[referrals] existing lookup:", existingErr.message);
    return "error";
  }
  if (existing) return "already";

  // Релизы с сайта до привязки Telegram лежат под user_uuid без telegram_id — их тоже считаем.
  const { data: profile, error: profileErr } = await admin
    .from("users")
    .select("id")
    .eq("telegram_id", refereeTelegramId)
    .maybeSingle();
  if (profileErr) {
    console.error("[referrals] profile lookup:", profileErr.message);
    return "error";
  }
  const uuid = (profile as { id?: string } | null)?.id;
  const ownerFilter =
    uuid && /^[0-9a-f-]{36}$/i.test(uuid)
      ? `telegram_id.eq.${refereeTelegramId},user_id.eq.${refereeTelegramId},user_uuid.eq.${uuid}`
      : `telegram_id.eq.${refereeTelegramId},user_id.eq.${refereeTelegramId}`;
  const { count, error: countErr } = await admin
    .from("releases")
    .select("id", { count: "exact", head: true })
    .or(ownerFilter);
  if (countErr) {
    console.error("[referrals] releases count:", countErr.message);
    return "error";
  }
  if ((count ?? 0) > 0) return "not_new";

  const { error: insertErr } = await admin
    .from("referrals")
    .insert({ referee_telegram_id: refereeTelegramId, referrer_telegram_id: referrer });
  if (insertErr) {
    if (insertErr.code === UNIQUE_VIOLATION) return "already";
    console.error("[referrals] attribute:", insertErr.message);
    return "error";
  }
  return "attributed";
}

export async function getReferralSummary(
  admin: SupabaseClient,
  telegramId: string
): Promise<ReferralSummary | null> {
  const code = await getOrCreateReferralCode(admin, telegramId);
  if (!code) return null;

  const [invitedRes, ownRes] = await Promise.all([
    admin
      .from("referrals")
      .select("paid_at, reward_redeemed_at")
      .eq("referrer_telegram_id", telegramId),
    admin.from("referrals").select("paid_at").eq("referee_telegram_id", telegramId).maybeSingle()
  ]);
  if (invitedRes.error) console.error("[referrals] summary:", invitedRes.error.message);
  const invited = (invitedRes.data ?? []) as Pick<ReferralRow, "paid_at" | "reward_redeemed_at">[];
  const own = ownRes.data as Pick<ReferralRow, "paid_at"> | null;

  return {
    code,
    link: referralLink(code),
    invited: invited.length,
    paid: invited.filter((r) => r.paid_at).length,
    available: invited.filter((r) => r.paid_at && !r.reward_redeemed_at).length,
    hasPendingDiscount: Boolean(own && !own.paid_at)
  };
}

/**
 * Строки для сообщения Денису «Оплатил?»: скидка другу и/или бонус пригласившему.
 * После «Оплатил» показывает то, что учли в этом релизе. Ошибки → пустой список.
 */
export async function referralPaymentLines(admin: SupabaseClient, release: ReleaseRef): Promise<string[]> {
  const tid = artistTelegramId(release);
  if (!tid) return [];
  try {
    const [asReferee, asReferrer] = await Promise.all([
      admin
        .from("referrals")
        .select("paid_release_id, paid_at")
        .eq("referee_telegram_id", tid)
        .maybeSingle(),
      admin
        .from("referrals")
        .select("reward_redeemed_release_id, reward_redeemed_at")
        .eq("referrer_telegram_id", tid)
        .not("paid_at", "is", null)
    ]);

    let discount = 0;
    const lines: string[] = [];

    const own = asReferee.data as Pick<ReferralRow, "paid_release_id" | "paid_at"> | null;
    if (own && (own.paid_at == null || own.paid_release_id === release.id)) {
      discount += REFEREE_DISCOUNT_RUB;
      lines.push(`🎁 Пришёл по приглашению: скидка ${formatRub(REFEREE_DISCOUNT_RUB)} на первый релиз`);
    }

    const rewards = (asReferrer.data ?? []) as Pick<ReferralRow, "reward_redeemed_release_id" | "reward_redeemed_at">[];
    const onThis = rewards.filter((r) => r.reward_redeemed_release_id === release.id).length;
    const available = rewards.filter((r) => r.reward_redeemed_at == null).length;
    const count = release.payment_status === "paid" ? onThis : Math.min(onThis + available, MAX_REWARDS_PER_RELEASE);
    if (count > 0) {
      discount += count * REFERRER_REWARD_RUB;
      lines.push(
        `🎁 Бонус за приглашённых друзей: ${formatRub(count * REFERRER_REWARD_RUB)}` +
          (count > 1 ? ` (${count} × ${formatRub(REFERRER_REWARD_RUB)})` : "") +
          // Если на оплате несколько релизов артиста, бонус уйдёт только в первый отмеченный «Оплатил».
          (release.payment_status === "paid" ? "" : " — списывается на первый оплаченный релиз")
      );
    }

    if (lines.length > 1) lines.push(`Итого скидка: <b>${formatRub(discount)}</b>`);
    return lines;
  } catch (e) {
    console.error("[referrals] payment lines:", e);
    return [];
  }
}

/**
 * После смены статуса оплаты релиза.
 * → paid: первый оплаченный релиз друга открывает бонус пригласившему (+ сообщение ему);
 *         доступные бонусы самого артиста списываются на этот релиз (не больше MAX_REWARDS_PER_RELEASE).
 * paid → другое: откатываем то же самое, если бонус ещё не потрачен. Ошибки не пробрасываются.
 */
export async function applyReferralPaymentChange(
  admin: SupabaseClient,
  release: ReleaseRef,
  previous: PaymentStatus | null,
  next: PaymentStatus
): Promise<void> {
  const tid = artistTelegramId(release);
  if (!tid) return;
  try {
    const now = new Date().toISOString();

    if (next === "paid") {
      const { data: opened, error: openErr } = await admin
        .from("referrals")
        .update({ paid_release_id: release.id, paid_at: now })
        .eq("referee_telegram_id", tid)
        .is("paid_at", null)
        .select("referrer_telegram_id");
      if (openErr) console.error("[referrals] open reward:", openErr.message);
      const referrer = (opened as Pick<ReferralRow, "referrer_telegram_id">[] | null)?.[0]?.referrer_telegram_id;
      if (referrer) {
        await notifyArtist(
          { telegram_id: referrer },
          `🎁 <b>Друг оплатил первый релиз</b>\n\n` +
            `Тебе бонус ${formatRub(REFERRER_REWARD_RUB)} — студия учтёт его при оплате твоего следующего выпуска.`
        );
      }

      const { data: avail, error: availErr } = await admin
        .from("referrals")
        .select("referee_telegram_id")
        .eq("referrer_telegram_id", tid)
        .not("paid_at", "is", null)
        .is("reward_redeemed_at", null)
        .order("paid_at", { ascending: true })
        .limit(MAX_REWARDS_PER_RELEASE);
      if (availErr) console.error("[referrals] available rewards:", availErr.message);
      const referees = ((avail ?? []) as Pick<ReferralRow, "referee_telegram_id">[]).map((r) => r.referee_telegram_id);
      if (referees.length > 0) {
        const { error } = await admin
          .from("referrals")
          .update({ reward_redeemed_release_id: release.id, reward_redeemed_at: now })
          .in("referee_telegram_id", referees)
          .is("reward_redeemed_at", null);
        if (error) console.error("[referrals] redeem:", error.message);
      }
      return;
    }

    if (previous === "paid") {
      const { error: closeErr } = await admin
        .from("referrals")
        .update({ paid_release_id: null, paid_at: null })
        .eq("paid_release_id", release.id)
        .is("reward_redeemed_at", null);
      if (closeErr) console.error("[referrals] close reward:", closeErr.message);

      const { error: unredeemErr } = await admin
        .from("referrals")
        .update({ reward_redeemed_release_id: null, reward_redeemed_at: null })
        .eq("reward_redeemed_release_id", release.id);
      if (unredeemErr) console.error("[referrals] unredeem:", unredeemErr.message);
    }
  } catch (e) {
    console.error("[referrals] payment change:", e);
  }
}
