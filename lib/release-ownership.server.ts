import type { SupabaseClient } from "@supabase/supabase-js";

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
