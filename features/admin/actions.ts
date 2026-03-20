import { getExpectedAdminTelegramId } from "@/lib/admin";
import { getTelegramUserId } from "@/lib/telegram";
import {
  updateReleaseStatus,
  type ReleaseRecord
} from "@/repositories/releases.repo";

function assertAdmin(): void {
  if (process.env.NODE_ENV === "development") {
    return;
  }
  const uid = getTelegramUserId();
  const adminId = getExpectedAdminTelegramId();
  if (uid == null || uid !== adminId) {
    throw new Error("Доступ только для администратора.");
  }
}

/**
 * Одобрить релиз: статус `ready`, `error_message` очищается.
 * Запросы идут по `id` релиза; RLS для админа (x-telegram-user-id) в Supabase.
 */
export async function approveRelease(releaseId: string): Promise<ReleaseRecord> {
  assertAdmin();
  return updateReleaseStatus(releaseId, { status: "ready" });
}

/**
 * Отклонить релиз: в схеме БД используется статус `failed` (не `error`);
 * причина сохраняется в колонку `error_message`.
 */
export async function rejectRelease(
  releaseId: string,
  comment: string
): Promise<ReleaseRecord> {
  assertAdmin();
  const msg = comment.trim() || "Отклонено модератором";
  return updateReleaseStatus(releaseId, {
    status: "failed",
    error_message: msg
  });
}
