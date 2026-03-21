import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/api/get-telegram-init-data-from-request";
import { getTelegramWebApp } from "@/lib/telegram";
import type { AdminStatsResponse } from "@/types/admin";

export async function fetchAdminStats(): Promise<AdminStatsResponse> {
  const initData = getTelegramWebApp()?.initData;
  const headers = new Headers();
  headers.set("Accept", "application/json");
  if (initData) {
    headers.set(TELEGRAM_INIT_DATA_HEADER, initData);
  }

  const res = await fetch("/api/admin/stats", {
    method: "GET",
    credentials: "same-origin",
    headers,
    cache: "no-store"
  });

  const json: unknown = await res.json();

  if (!res.ok) {
    const err =
      typeof json === "object" && json !== null && "error" in json && typeof (json as { error: unknown }).error === "string"
        ? (json as { error: string }).error
        : "Не удалось загрузить статистику. Попробуйте обновить страницу.";
    throw new Error(err);
  }

  const body = json as AdminStatsResponse;
  if (body.ok !== true) {
    throw new Error("Не удалось загрузить статистику. Попробуйте обновить страницу.");
  }

  return body;
}
