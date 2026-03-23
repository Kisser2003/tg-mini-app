/**
 * Прямая загрузка треков в Storage с клиента (anon + x-telegram-user-id через supabase client).
 * Для файлов 8–32 MiB — загрузка частями + сборка на сервере (меньше обрывов в мобильном WebView).
 */

import { supabase } from "@/lib/supabase";
import { STORAGE_BUCKET_RELEASE_TRACKS } from "@/lib/storage-buckets";
import { getReleaseTrackAudioPartPath } from "@/lib/storagePaths";
import { uploadToSupabaseStorageObject } from "@/lib/storage-upload-client";
import { getTelegramApiAuthHeaders } from "@/lib/telegram";

/** 8 MiB — меньше частей при WAV до 200 МБ (мобильный WebView часто рвёт один длинный POST). */
const CHUNK_BYTES = 8 * 1024 * 1024;
const MIN_CHUNKED_FILE = 8 * 1024 * 1024;
/** Совпадает с RELEASE_FILE_LIMITS.audioMaxMb — один большой XHR без чанков на телефоне часто падает по таймауту/обрыву. */
const MAX_CHUNKED_FILE = 200 * 1024 * 1024;
const MAX_CHUNK_PARTS = 32;

export type TrackChunkedUploadMeta = {
  userId: number;
  releaseId: string;
  trackIndex: number;
};

/**
 * Загрузка WAV в bucket `releases` (не через Server Actions / Vercel).
 * При `chunkedMeta` и размере в диапазоне — multipart на Storage + POST stitch.
 */
export async function uploadReleaseTrackFileClient(
  objectPath: string,
  file: File,
  options?: {
    onProgress?: (percent: number) => void;
    chunkedMeta?: TrackChunkedUploadMeta;
  }
): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Загрузка трека доступна только в браузере.");
  }

  const meta = options?.chunkedMeta;
  const canChunk =
    meta != null &&
    file.size > MIN_CHUNKED_FILE &&
    file.size <= MAX_CHUNKED_FILE;

  if (canChunk && meta) {
    const partCount = Math.ceil(file.size / CHUNK_BYTES);
    if (partCount <= MAX_CHUNK_PARTS) {
      const chunkProgressCap = 82;
      for (let i = 0; i < partCount; i++) {
        const start = i * CHUNK_BYTES;
        const end = Math.min(start + CHUNK_BYTES, file.size);
        const blob = file.slice(start, end);
        const chunkFile = new File([blob], `part-${i}.wav`, {
          type: file.type?.trim() || "audio/wav"
        });
        const partPath = getReleaseTrackAudioPartPath(
          meta.userId,
          meta.releaseId,
          meta.trackIndex,
          i
        );
        await uploadToSupabaseStorageObject({
          bucket: STORAGE_BUCKET_RELEASE_TRACKS,
          objectPath: partPath,
          file: chunkFile,
          upsert: true,
          onProgress: (p) => {
            const base = (i / partCount) * chunkProgressCap;
            const slice = (p / 100) * (chunkProgressCap / partCount);
            options.onProgress?.(Math.round(base + slice));
          }
        });
      }

      options.onProgress?.(88);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...getTelegramApiAuthHeaders({ userId: meta.userId })
      };
      const res = await fetch("/api/releases/stitch-track-parts", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          releaseId: meta.releaseId,
          trackIndex: meta.trackIndex,
          partCount
        })
      });

      if (!res.ok) {
        const raw = await res.text();
        let message = `HTTP ${res.status}`;
        try {
          const j = JSON.parse(raw) as { error?: string };
          if (typeof j.error === "string" && j.error.length > 0) message = j.error;
        } catch {
          /* ignore */
        }
        const err = new Error(message) as Error & { statusCode: number };
        err.statusCode = res.status;
        throw err;
      }

      options.onProgress?.(100);
      return;
    }
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
