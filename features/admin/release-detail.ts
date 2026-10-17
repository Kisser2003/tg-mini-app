"use client";

import { getAdminApiAuthHeaders } from "@/lib/admin";
import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases.repo";
import type { ReleaseReferral } from "@/lib/server/referrals";
import type { PressKit } from "@/lib/press-kit";

export async function fetchAdminReleaseDetail(
  releaseId: string
): Promise<{
  release: ReleaseRecord;
  tracks: ReleaseTrackRow[];
  referral: ReleaseReferral | null;
  pressKit: PressKit | null;
}> {
  const authHeaders = await getAdminApiAuthHeaders();
  const res = await fetch(`/api/admin/releases/${encodeURIComponent(releaseId)}`, {
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
    referral?: ReleaseReferral | null;
    pressKit?: PressKit | null;
  };
  if (parsed.ok !== true || !parsed.release || !Array.isArray(parsed.tracks)) {
    throw new Error("Некорректный ответ сервера.");
  }

  return {
    release: parsed.release,
    tracks: parsed.tracks,
    referral: parsed.referral ?? null,
    pressKit: parsed.pressKit ?? null
  };
}
