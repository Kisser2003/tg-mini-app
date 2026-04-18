import type { SupabaseClient } from "@supabase/supabase-js";

/** Telegram initData или веб-сессия Supabase (`releases.user_uuid`). */
export type ReleaseActor =
  | { kind: "telegram"; telegramUserId: number }
  | { kind: "web"; authUserId: string };

/**
 * Владелец релиза: Mini App (Telegram id) или веб (JWT `auth.uid()` = `releases.user_uuid`).
 */
export async function isReleaseActorOwner(
  admin: SupabaseClient,
  row: Record<string, unknown>,
  actor: ReleaseActor
): Promise<boolean> {
  if (actor.kind === "web") {
    const uu = row.user_uuid;
    return typeof uu === "string" && uu.length > 0 && uu === actor.authUserId;
  }
  return isTelegramReleaseOwner(admin, row, actor.telegramUserId);
}

/** Для `ai_moderation_logs.user_id`: в TG — id из контекста; на вебе — числовой `releases.user_id` (в т.ч. синтетический). */
export function numericUserIdForReleaseAiLogs(
  actor: ReleaseActor,
  row: Record<string, unknown>
): number {
  if (actor.kind === "telegram") {
    return actor.telegramUserId;
  }
  const raw = row.user_id;
  const n =
    typeof raw === "bigint" ? Number(raw) : typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  return 9_000_000_001;
}

/**
 * Проверка владельца релиза для Telegram Mini App (verified initData → ctx.user.id).
 * Учитывает legacy `user_id`, колонку `telegram_id` и связку `user_uuid` → public.users.
 */
export async function isTelegramReleaseOwner(
  admin: SupabaseClient,
  row: Record<string, unknown>,
  telegramUserId: number
): Promise<boolean> {
  const tg = String(telegramUserId);

  const rawUid = row.user_id;
  if (rawUid != null && String(rawUid).trim() === tg) {
    return true;
  }

  const rawTid = row.telegram_id;
  if (rawTid != null && String(rawTid).trim() === tg) {
    return true;
  }

  const uu = row.user_uuid;
  if (typeof uu === "string" && uu.length > 0) {
    const { data: profile } = await admin.from("users").select("telegram_id").eq("id", uu).maybeSingle();
    const p = profile as { telegram_id?: number | null } | null;
    if (p?.telegram_id != null && Number(p.telegram_id) === telegramUserId) {
      return true;
    }
  }

  return false;
}
