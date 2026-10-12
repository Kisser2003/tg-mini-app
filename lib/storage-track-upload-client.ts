/**
 * Resumable WAV upload to Supabase Storage via TUS.
 */

import { MAX_WAV_MB, STORAGE_BUCKET_RELEASE_TRACKS } from "@/lib/storage-buckets";
import { getTelegramUserIdForSupabaseRequests } from "@/lib/telegram";
import { Upload } from "tus-js-client";
import { getTelegramApiAuthHeaders } from "@/lib/telegram";

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

async function uploadReleaseTrackFileViaTus(
  objectPath: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  const { url, anonKey } = getSupabasePublicConfig();
  const rlsUserId = getTelegramUserIdForSupabaseRequests();

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${url.replace(/\/$/, "")}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      headers: {
        authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        "x-upsert": "true",
        ...(rlsUserId != null ? { "x-telegram-user-id": String(rlsUserId) } : {})
      },
      metadata: {
        bucketName: STORAGE_BUCKET_RELEASE_TRACKS,
        objectName: objectPath,
        contentType: file.type?.trim() || "audio/wav",
        cacheControl: "3600"
      },
      onProgress(bytesUploaded, bytesTotal) {
        if (!bytesTotal || bytesTotal <= 0) return;
        const pct = Math.round((bytesUploaded / bytesTotal) * 100);
        onProgress?.(Math.min(100, Math.max(0, pct)));
      },
      onError(error) {
        const status = (error as { originalResponse?: { getStatus?: () => number } | null })
          .originalResponse?.getStatus?.();
        if (status === 413) {
          reject(
            new Error(
              `Файл слишком большой для хранилища (лимит ${MAX_WAV_MB} МБ). Сожми WAV или выбери файл поменьше.`
            )
          );
          return;
        }
        reject(error);
      },
      onSuccess() {
        onProgress?.(100);
        resolve();
      }
    });

    upload.start();
  });
}

/** true, если аудио нужно грузить во внешнее S3-хранилище (флаг задаётся на сборке). */
export function isExternalAudioStorageEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUDIO_STORAGE === "s3";
}

/** Прямая загрузка WAV в S3-совместимое хранилище по presigned URL (с прогрессом). */
async function uploadReleaseTrackFileToS3(
  releaseId: string,
  trackIndex: number,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const res = await fetch("/api/releases/audio-upload-url", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...getTelegramApiAuthHeaders() },
    body: JSON.stringify({ releaseId, trackIndex })
  });
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    uploadUrl?: string;
    publicUrl?: string;
    error?: string;
  } | null;
  if (!res.ok || !json?.ok || !json.uploadUrl || !json.publicUrl) {
    throw new Error(json?.error || "Не получилось подготовить загрузку файла. Попробуй ещё раз.");
  }
  const { uploadUrl, publicUrl } = json;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type?.trim() || "audio/wav");
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || e.total <= 0) return;
      onProgress?.(Math.min(99, Math.max(0, Math.round((e.loaded / e.total) * 100))));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else if (xhr.status === 413) {
        reject(new Error("Файл слишком большой для хранилища. Сожми WAV или выбери файл поменьше."));
      } else {
        reject(new Error(`Хранилище отклонило файл (код ${xhr.status}). Попробуй ещё раз.`));
      }
    };
    xhr.onerror = () =>
      reject(new Error("Загрузка прервалась: проверь интернет и попробуй ещё раз."));
    xhr.onabort = () => reject(new Error("Загрузка отменена."));
    xhr.send(file);
  });

  return publicUrl;
}

/**
 * Загружает WAV трека. Возвращает публичный URL, если файл ушёл во внешнее хранилище,
 * или null, если в Supabase Storage (тогда URL строит вызывающий код).
 */
export async function uploadReleaseTrackFileClient(
  objectPath: string,
  file: File,
  options?: {
    onProgress?: (percent: number) => void;
    releaseId?: string;
    trackIndex?: number;
  }
): Promise<string | null> {
  if (typeof window === "undefined") {
    throw new Error("Загрузка трека доступна только в браузере.");
  }

  if (isExternalAudioStorageEnabled() && options?.releaseId != null && options.trackIndex != null) {
    return uploadReleaseTrackFileToS3(options.releaseId, options.trackIndex, file, options.onProgress);
  }

  await uploadReleaseTrackFileViaTus(objectPath, file, options?.onProgress);
  return null;
}
