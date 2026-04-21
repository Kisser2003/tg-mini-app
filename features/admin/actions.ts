"use client";

import type { ReleaseRecord } from "@/repositories/releases.repo";
import {
  getAdminTelegramIdForUi,
  getAdminApiAuthHeaders,
  telegramIdsEqual
} from "@/lib/admin";
import { getTelegramUserId } from "@/lib/telegram";

function assertAdmin(): void {
  if (process.env.NODE_ENV === "development") {
    return;
  }
  const uid = getTelegramUserId();
  const adminId = getAdminTelegramIdForUi();
  if (uid == null || adminId === null || !telegramIdsEqual(uid, adminId)) {
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
  assertAdmin();
  return postModeration({ releaseId, action: "approve" });
}

/**
 * Отклонить релиз: статус `failed`; причина в `error_message` / `admin_notes`.
 */
export async function rejectRelease(releaseId: string, comment: string): Promise<ReleaseRecord> {
  assertAdmin();
  return postModeration({ releaseId, action: "reject", comment });
}
