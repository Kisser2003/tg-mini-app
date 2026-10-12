import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getUserProfileByTelegramId } from "@/lib/auth/hybrid-auth";
import { sendTelegramNotification } from "@/lib/telegram-notifications";

type NotifiableRelease = {
  telegram_id?: unknown;
  user_uuid?: string | null;
};

/** Уважает настройку «Уведомления» (user_preferences.push_notifications). Ошибки → считаем, что можно. */
async function isPushEnabled(record: NotifiableRelease, telegramId: string): Promise<boolean> {
  try {
    const admin = createSupabaseAdmin();
    if (!admin) return true;
    let uuid = typeof record.user_uuid === "string" && record.user_uuid ? record.user_uuid : null;
    if (!uuid) {
      const profile = await getUserProfileByTelegramId(BigInt(telegramId));
      uuid = profile?.id ?? null;
    }
    if (!uuid) return true;
    const { data } = await admin
      .from("user_preferences")
      .select("push_notifications")
      .eq("user_uuid", uuid)
      .maybeSingle();
    return data?.push_notifications !== false;
  } catch {
    return true;
  }
}

/**
 * Сообщение артисту в Telegram о событии по релизу.
 * Пропускается, если у релиза нет telegram_id (веб-аккаунт) или артист выключил уведомления.
 * Веб-пользователи видят изменения статуса в приложении (метка «Новое» в списке релизов).
 */
export async function notifyArtist(record: NotifiableRelease, text: string): Promise<void> {
  const tid =
    record.telegram_id != null && String(record.telegram_id).trim() !== ""
      ? String(record.telegram_id).trim()
      : null;
  if (!tid || !/^\d+$/.test(tid)) return;
  if (!(await isPushEnabled(record, tid))) return;
  await sendTelegramNotification(tid, text);
}
