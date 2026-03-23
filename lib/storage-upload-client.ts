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

function shouldRetryStorageUploadOnce(e: unknown): boolean {
  if (e && typeof e === "object" && "statusCode" in e) {
    const sc = Number((e as { statusCode?: unknown }).statusCode);
    if (Number.isFinite(sc)) {
      if (sc === 0 || sc === 408 || sc === 429 || (sc >= 500 && sc < 600)) return true;
    }
  }
  if (e instanceof Error) {
    const m = e.message;
    if (m.includes("Сетевая ошибка") || m.includes("Таймаут")) return true;
  }
  return false;
}

/**
 * POST /storage/v1/object/{bucket}/{path}
 * Одна попытка XHR (внутренняя).
 */
function uploadToSupabaseStorageObjectOnce(
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
    xhr.timeout = 600000;
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
        /** До ответа сервера не показываем 100% — иначе на мобильных кажется, что всё ок, а потом 403/413/5xx. */
        options.onProgress(Math.max(0, Math.min(99, pct)));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(100);
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
    xhr.ontimeout = () => reject(new Error("Таймаут загрузки (проверьте сеть или размер файла)."));

    xhr.send(options.file);
  });
}

/**
 * С повтором при обрыве / 5xx (часто в Telegram WebView на первом заходе).
 */
export async function uploadToSupabaseStorageObject(
  options: SupabaseStorageUploadOptions
): Promise<void> {
  const maxAttempts = 2;
  let last: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await uploadToSupabaseStorageObjectOnce(options);
      return;
    } catch (e) {
      last = e;
      if (attempt < maxAttempts && shouldRetryStorageUploadOnce(e)) {
        await new Promise((r) => setTimeout(r, 450));
        continue;
      }
      throw e;
    }
  }
  throw last;
}
