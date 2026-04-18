"use client";

import { getTelegramApiAuthHeadersForAdminApi } from "@/lib/admin";
import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases.repo";

export async function fetchAdminReleaseDetail(
  releaseId: string
): Promise<{ release: ReleaseRecord; tracks: ReleaseTrackRow[] }> {
  const res = await fetch(`/api/admin/releases/${encodeURIComponent(releaseId)}`, {
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
    throw new Error("Не удалось загрузить релиз.");
  }

  if (!res.ok) {
    const err =
      typeof json === "object" && json !== null && "error" in json && typeof (json as { error: unknown }).error === "string"
        ? (json as { error: string }).error
        : "Не удалось загрузить релиз.";
    throw new Error(err);
  }

  const parsed = json as {
    ok?: boolean;
    release?: ReleaseRecord;
    tracks?: ReleaseTrackRow[];
  };
  if (parsed.ok !== true || !parsed.release || !Array.isArray(parsed.tracks)) {
    throw new Error("Некорректный ответ сервера.");
  }

  return { release: parsed.release, tracks: parsed.tracks };
}
