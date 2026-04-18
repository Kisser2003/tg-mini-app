"use client";

import { getTelegramApiAuthHeadersForAdminApi } from "@/lib/admin";
import type { ModerationQueueApiRow } from "@/types/admin";

/**
 * Очередь модерации только через API (service role + проверка админа на сервере).
 * Не использует прямой Supabase с RLS по заголовку `x-telegram-user-id`.
 */
export async function fetchAdminModerationQueue(): Promise<ModerationQueueApiRow[]> {
  const res = await fetch("/api/admin/moderation-queue", {
    method: "GET",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...getTelegramApiAuthHeadersForAdminApi()
    },
    cache: "no-store"
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("Не удалось загрузить очередь модерации.");
  }

  if (!res.ok) {
    const err =
      typeof json === "object" && json !== null && "error" in json && typeof (json as { error: unknown }).error === "string"
        ? (json as { error: string }).error
        : "Не удалось загрузить очередь модерации.";
    throw new Error(err);
  }

  const parsed = json as { ok?: boolean; rows?: ModerationQueueApiRow[] };
  if (parsed.ok !== true || !Array.isArray(parsed.rows)) {
    throw new Error("Некорректный ответ сервера.");
  }

  return parsed.rows;
}
