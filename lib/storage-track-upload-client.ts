/**
 * Resumable WAV upload to Supabase Storage via TUS.
 */

import { STORAGE_BUCKET_RELEASE_TRACKS } from "@/lib/storage-buckets";
import { getTelegramUserIdForSupabaseRequests } from "@/lib/telegram";
import { Upload } from "tus-js-client";

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

export async function uploadReleaseTrackFileClient(
  objectPath: string,
  file: File,
  options?: {
    onProgress?: (percent: number) => void;
  }
): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Загрузка трека доступна только в браузере.");
  }

  await uploadReleaseTrackFileViaTus(objectPath, file, options?.onProgress);
}
