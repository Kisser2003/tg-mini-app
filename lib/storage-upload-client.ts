/**
 * Прямая загрузка в Supabase Storage через XMLHttpRequest для отслеживания прогресса.
 * Клиент @supabase/supabase-js для upload не отдаёт onUploadProgress в текущей версии.
 */

import { getTelegramUserIdForSupabaseRequests } from "./telegram";

function encodeStorageObjectPath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export type SupabaseStorageUploadOptions = {
  bucket: string;
  objectPath: string;
  file: File;
  upsert?: boolean;
  /** 0–100 */
  onProgress?: (percent: number) => void;
};

function getSupabasePublicConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY обязательны для загрузки файлов."
    );
  }
  return { url, anonKey };
}

/**
 * POST /storage/v1/object/{bucket}/{path}
 */
export function uploadToSupabaseStorageObject(
  options: SupabaseStorageUploadOptions
): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Загрузка с прогрессом доступна только в браузере."));
  }

  const { url, anonKey } = getSupabasePublicConfig();
  const encodedPath = encodeStorageObjectPath(options.objectPath);
  const endpoint = `${url.replace(/\/$/, "")}/storage/v1/object/${options.bucket}/${encodedPath}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.setRequestHeader("Authorization", `Bearer ${anonKey}`);
    xhr.setRequestHeader("apikey", anonKey);
    const rlsUserId = getTelegramUserIdForSupabaseRequests();
    if (rlsUserId != null) {
      xhr.setRequestHeader("x-telegram-user-id", String(rlsUserId));
    }
    if (options.upsert) {
      xhr.setRequestHeader("x-upsert", "true");
    }
    const contentType =
      options.file.type && options.file.type.length > 0
        ? options.file.type
        : "application/octet-stream";
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && options.onProgress && ev.total > 0) {
        const pct = Math.round((ev.loaded / ev.total) * 100);
        options.onProgress(Math.max(0, Math.min(100, pct)));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      const rawBody = xhr.responseText || "";
      let message = `HTTP ${xhr.status}`;
      try {
        const parsed = JSON.parse(rawBody || "{}") as { message?: string; error?: string };
        message = parsed.message || parsed.error || message;
      } catch {
        message = xhr.statusText || message;
      }
      const err = new Error(message) as Error & {
        statusCode: number;
        responseBody: string;
      };
      err.statusCode = xhr.status;
      err.responseBody = rawBody.slice(0, 800);
      reject(err);
    };

    xhr.onerror = () => reject(new Error("Сетевая ошибка при загрузке файла."));
    xhr.onabort = () => reject(new Error("Загрузка прервана."));

    xhr.send(options.file);
  });
}
