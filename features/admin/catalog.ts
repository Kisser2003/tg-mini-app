"use client";

import { getAdminApiAuthHeaders } from "@/lib/admin";
import type { AdminCatalogRelease } from "@/types/admin";

/** Все принятые релизы с треками (экран «Каталог»). */
export async function fetchAdminCatalog(): Promise<{ rows: AdminCatalogRelease[]; truncated: boolean }> {
  const authHeaders = await getAdminApiAuthHeaders();
  const res = await fetch("/api/admin/catalog", {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json", ...authHeaders },
    cache: "no-store"
  });
  type CatalogResponse = { ok?: boolean; rows?: AdminCatalogRelease[]; truncated?: boolean; error?: string };
  let json: CatalogResponse | null = null;
  try {
    json = (await res.json()) as CatalogResponse;
  } catch {
    json = null;
  }
  if (!res.ok || json?.ok !== true || !Array.isArray(json.rows)) {
    throw new Error(json?.error || "Не удалось загрузить каталог.");
  }
  return { rows: json.rows, truncated: json.truncated === true };
}
