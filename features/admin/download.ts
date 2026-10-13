"use client";

import { getAdminApiAuthHeaders } from "@/lib/admin";
import { isTelegramMiniApp, getTelegramWebApp } from "@/lib/telegram";

/**
 * Скачивание файла из админ API (Telegram initData / dev-заголовки).
 */
export async function fetchAdminBlobDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const authHeaders = await getAdminApiAuthHeaders();
  const res = await fetch(path, {
    method: "GET",
    credentials: "same-origin",
    headers: {
      Accept: "*/*",
      ...authHeaders
    },
    cache: "no-store"
  });

  if (!res.ok) {
    let msg = `Ошибка ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (typeof j.error === "string" && j.error.length > 0) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition");
  let filename = "download";
  if (cd) {
    const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
    const plain = /filename="([^"]+)"/i.exec(cd);
    if (star?.[1]) {
      try {
        filename = decodeURIComponent(star[1].trim());
      } catch {
        filename = star[1].trim();
      }
    } else if (plain?.[1]) {
      filename = plain[1].trim();
    }
  }

  return { blob, filename };
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * В Telegram blob-ссылки не открываются (macOS отдаёт их системе, и скачивания нет).
 * Берём у сервера подписанную ссылку и открываем её во внешнем браузере.
 */
async function openSignedDownloadInBrowser(path: string): Promise<boolean> {
  const authHeaders = await getAdminApiAuthHeaders();
  const res = await fetch("/api/admin/download-link", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders },
    body: JSON.stringify({ path }),
    cache: "no-store"
  });
  if (!res.ok) return false;
  const json = (await res.json().catch(() => null)) as { ok?: boolean; path?: string } | null;
  if (!json?.ok || typeof json.path !== "string") return false;
  const url = new URL(json.path, window.location.origin).toString();
  const webApp = getTelegramWebApp();
  if (webApp?.openLink) {
    webApp.openLink(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return true;
}

export async function adminDownloadToDisk(path: string, filenameFallback: string): Promise<void> {
  if (isTelegramMiniApp() && (await openSignedDownloadInBrowser(path).catch(() => false))) {
    return;
  }
  const { blob, filename } = await fetchAdminBlobDownload(path);
  triggerBrowserDownload(blob, filename || filenameFallback);
}
