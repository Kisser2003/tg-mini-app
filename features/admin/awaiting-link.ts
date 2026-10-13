"use client";

import { getAdminApiAuthHeaders } from "@/lib/admin";
import type { AdminAwaitingLinkRelease } from "@/types/admin";

/** Принятые релизы без ссылки на пресейв (блок «Ждут ссылку»). */
export async function fetchAdminAwaitingLink(): Promise<AdminAwaitingLinkRelease[]> {
  const authHeaders = await getAdminApiAuthHeaders();
  const res = await fetch("/api/admin/awaiting-link", {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json", ...authHeaders },
    cache: "no-store"
  });
  type Body = { ok?: boolean; rows?: AdminAwaitingLinkRelease[]; error?: string };
  let json: Body | null = null;
  try {
    json = (await res.json()) as Body;
  } catch {
    json = null;
  }
  if (!res.ok || json?.ok !== true || !Array.isArray(json.rows)) {
    throw new Error(json?.error || "Не удалось загрузить релизы без ссылки.");
  }
  return json.rows;
}
