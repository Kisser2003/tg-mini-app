"use client";

import { getAdminApiAuthHeaders } from "@/lib/admin";
import type { ModerationQueueApiRow } from "@/types/admin";

export type ModerationHistoryResult = {
  rows: ModerationQueueApiRow[];
  truncated: boolean;
};

/**
 * Релизы со статусом ready / failed (после решения модерации).
 */
export async function fetchAdminModerationHistory(limit = 200): Promise<ModerationHistoryResult> {
  const authHeaders = await getAdminApiAuthHeaders();
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`/api/admin/moderation-history?${params}`, {
    method: "GET",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...authHeaders
    },
    cache: "no-store"
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("Не удалось загрузить историю модерации.");
  }

  if (!res.ok) {
    const err =
      typeof json === "object" && json !== null && "error" in json && typeof (json as { error: unknown }).error === "string"
        ? (json as { error: string }).error
        : "Не удалось загрузить историю модерации.";
    throw new Error(err);
  }

  const parsed = json as { ok?: boolean; rows?: ModerationQueueApiRow[]; truncated?: boolean };
  if (parsed.ok !== true || !Array.isArray(parsed.rows)) {
    throw new Error("Некорректный ответ сервера.");
  }

  return {
    rows: parsed.rows,
    truncated: parsed.truncated === true
  };
}
