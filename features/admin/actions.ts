"use client";

import type { ReleaseRecord } from "@/repositories/releases.repo";
import {
  getAdminTelegramIdForUi,
  getAdminApiAuthHeaders,
  isAdminUiByWebSession,
  telegramIdsEqual
} from "@/lib/admin";
import { getTelegramUserId } from "@/lib/telegram";

/**
 * В production: Telegram ID совпадает с ADMIN_TELEGRAM_ID **или** веб-сессия Supabase
 * с `public.users.role = 'admin'` (как в `requireAdminSupabaseClient` / `isAdminUiByWebSession`).
 */
async function assertAdminAsync(): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    return;
  }
  const uid = getTelegramUserId();
  const adminId = getAdminTelegramIdForUi();
  if (uid != null && adminId != null && telegramIdsEqual(uid, adminId)) {
    return;
  }
  const webAdmin = await isAdminUiByWebSession();
  if (!webAdmin) {
    throw new Error("Доступ только для администратора.");
  }
}

async function postModeration(
  body: { releaseId: string; action: "approve" | "reject"; comment?: string }
): Promise<ReleaseRecord> {
  const authHeaders = await getAdminApiAuthHeaders();
  const res = await fetch("/api/admin/update-release-status", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("Не удалось обновить статус релиза.");
  }

  if (!res.ok) {
    const err =
      typeof json === "object" && json !== null && "error" in json && typeof (json as { error: unknown }).error === "string"
        ? (json as { error: string }).error
        : "Не удалось обновить статус релиза.";
    throw new Error(err);
  }

  const parsed = json as { ok?: boolean; record?: ReleaseRecord };
  if (parsed.ok !== true || !parsed.record) {
    throw new Error("Не удалось обновить статус релиза.");
  }

  return parsed.record;
}

/**
 * Одобрить релиз: статус `ready`, `error_message` очищается.
 * Обновление через API с service role (обходит RLS Mini App клиента).
 */
export async function approveRelease(releaseId: string): Promise<ReleaseRecord> {
  await assertAdminAsync();
  return postModeration({ releaseId, action: "approve" });
}

/**
 * Отклонить релиз: статус `failed`; причина в `error_message` / `admin_notes`.
 */
export async function rejectRelease(releaseId: string, comment: string): Promise<ReleaseRecord> {
  await assertAdminAsync();
  return postModeration({ releaseId, action: "reject", comment });
}

async function postPublishSmartLink(body: {
  releaseId: string;
  newStatus: string;
  smartLink: string;
}): Promise<ReleaseRecord> {
  const authHeaders = await getAdminApiAuthHeaders();
  const res = await fetch("/api/admin/publish-release-smart-link", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("Не удалось выпустить релиз со ссылкой.");
  }

  if (!res.ok) {
    const o = json as { error?: unknown; detail?: unknown };
    const base =
      typeof o.error === "string" && o.error.length > 0
        ? o.error
        : "Не удалось выпустить релиз со ссылкой.";
    const detail = typeof o.detail === "string" && o.detail.trim() ? o.detail.trim() : "";
    throw new Error(detail ? `${base} ${detail}` : base);
  }

  const parsed = json as { ok?: boolean; record?: ReleaseRecord };
  if (parsed.ok !== true || !parsed.record) {
    throw new Error("Не удалось выпустить релиз со ссылкой.");
  }

  return parsed.record;
}

/**
 * Выпуск релиза из модерации: статус `ready` в БД + `smart_link`.
 * `newStatus` с клиента обычно `RELEASED`; сервер нормализует под enum.
 */
export async function publishReleaseWithSmartLink(
  releaseId: string,
  newStatus: string,
  smartLink: string
): Promise<ReleaseRecord> {
  await assertAdminAsync();
  return postPublishSmartLink({ releaseId, newStatus, smartLink });
}
