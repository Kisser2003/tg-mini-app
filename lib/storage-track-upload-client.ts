/**
 * Прямая загрузка треков в Storage с клиента (anon + x-telegram-user-id через supabase client).
 * С прогрессом — XHR к тому же endpoint (SDK upload через fetch не отдаёт onUploadProgress).
 * Без прогресса — `supabase.storage.from(bucket).upload()` как в документации Supabase.
 */

import { supabase } from "@/lib/supabase";
import { STORAGE_BUCKET_RELEASE_TRACKS } from "@/lib/storage-buckets";
import { uploadToSupabaseStorageObject } from "@/lib/storage-upload-client";

/**
 * Загрузка WAV в bucket `releases` (не через Server Actions / Vercel).
 */
export async function uploadReleaseTrackFileClient(
  objectPath: string,
  file: File,
  options?: { onProgress?: (percent: number) => void }
): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Загрузка трека доступна только в браузере.");
  }

  if (options?.onProgress) {
    await uploadToSupabaseStorageObject({
      bucket: STORAGE_BUCKET_RELEASE_TRACKS,
      objectPath,
      file,
      upsert: true,
      onProgress: options.onProgress
    });
    return;
  }

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET_RELEASE_TRACKS)
    .upload(objectPath, file, {
      upsert: true,
      contentType: file.type?.trim() || "audio/wav",
      cacheControl: "3600"
    });

  if (error) {
    throw error;
  }
}
