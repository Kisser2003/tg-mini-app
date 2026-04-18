"use client";

import { getTelegramApiAuthHeadersForAdminApi } from "@/lib/admin";

/**
 * Скачивание файла из админ API (Telegram initData / dev-заголовки).
 */
export async function fetchAdminBlobDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(path, {
    method: "GET",
    credentials: "same-origin",
    headers: {
      Accept: "*/*",
      ...getTelegramApiAuthHeadersForAdminApi()
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

export async function adminDownloadToDisk(path: string, filenameFallback: string): Promise<void> {
  const { blob, filename } = await fetchAdminBlobDownload(path);
  triggerBrowserDownload(blob, filename || filenameFallback);
}
