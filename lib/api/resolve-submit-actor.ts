import type { NextRequest } from "next/server";
import { getTelegramAuthContextFromRequest } from "@/lib/api/with-telegram-auth";
import { getSupabaseAuthUserIdFromCookies } from "@/lib/supabase-cookies-server";
import type { ReleaseActor } from "@/lib/release-ownership.server";

/**
 * Для API отправки/сохранения релиза: сначала Telegram initData, иначе cookie-сессия Supabase (веб).
 */
export async function resolveReleaseActor(request: NextRequest): Promise<ReleaseActor | null> {
  const tg = getTelegramAuthContextFromRequest(request);
  if (tg) {
    return { kind: "telegram", telegramUserId: Math.trunc(tg.user.id) };
  }
  const authId = await getSupabaseAuthUserIdFromCookies();
  if (authId) {
    return { kind: "web", authUserId: authId };
  }
  return null;
}
