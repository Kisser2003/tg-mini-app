import { supabase } from "../../lib/supabase";
import { uploadToSupabaseStorageObject } from "../../lib/storage-upload-client";
import { uploadReleaseTrackFileClient } from "../../lib/storage-track-upload-client";
import {
  STORAGE_BUCKET_ARTWORK,
  STORAGE_BUCKET_AUDIO_LEGACY,
  STORAGE_BUCKET_RELEASE_TRACKS
} from "../../lib/storage-buckets";
import {
  getReleaseAudioPath,
  getReleaseArtworkPath,
  getReleaseTrackAudioPath
} from "../../lib/storagePaths";
import { withRetry, markReleaseFailed } from "./queries";
import { ALLOWED_AUDIO_MIME, ALLOWED_ARTWORK_MIME, RELEASE_FILE_LIMITS } from "./types";
import type { UploadAssetOptions } from "./types";

async function removeStorageObjectsQuiet(bucket: string, paths: string[]): Promise<void> {
  const unique = [...new Set(paths.filter((p) => p.length > 0))];
  if (unique.length === 0) return;

  try {
    const { error } = await supabase.storage.from(bucket).remove(unique);
    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (!msg.includes("not found") && !msg.includes("404")) {
        console.warn("[storage] remove:", error.message);
      }
    }
  } catch {
    /* ignore — best-effort cleanup */
  }
}

async function putObjectWithProgress(
  bucket: string,
  objectPath: string,
  file: File,
  options?: { upsert?: boolean; onProgress?: (percent: number) => void }
): Promise<void> {
  if (typeof window !== "undefined") {
    await uploadToSupabaseStorageObject({
      bucket,
      objectPath,
      file,
      upsert: options?.upsert ?? true,
      onProgress: options?.onProgress
    });
  } else {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(objectPath, file, { upsert: options?.upsert ?? true });
    if (error) throw error;
  }
}

function humanizeUploadError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

async function handleUploadFailure(
  releaseId: string | undefined,
  err: unknown,
  context: string
): Promise<void> {
  if (!releaseId) return;
  const message = `${context}: ${humanizeUploadError(err, "неизвестная ошибка")}`;
  try {
    await markReleaseFailed(releaseId, message);
  } catch {
    /* уже отдали ошибку выше */
  }
}

function validateAudioFileStrict(file: File, maxSizeMb: number): void {
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > maxSizeMb) {
    throw new Error(`Аудио слишком большое. Максимум ${maxSizeMb} МБ.`);
  }
  const name = file.name.toLowerCase();
  const hasWavExt = name.endsWith(".wav");
  const mime = file.type.trim().toLowerCase();

  if (ALLOWED_AUDIO_MIME.has(mime)) return;
  if (mime.length === 0 && hasWavExt) return;
  if (mime === "application/octet-stream" && hasWavExt) return;

  throw new Error(
    "Допустим только WAV: MIME audio/wav / audio/x-wav или файл с расширением .wav."
  );
}

function validateArtworkFileStrict(file: File, maxSizeMb: number): void {
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > maxSizeMb) {
    throw new Error(`Обложка слишком большая. Максимум ${maxSizeMb} МБ.`);
  }
  const mime = file.type.trim().toLowerCase();
  if (!ALLOWED_ARTWORK_MIME.has(mime)) {
    throw new Error("Обложка: допустимы только image/jpeg или image/png.");
  }
}

export async function uploadReleaseAudio(params: {
  userId: number;
  releaseId: string;
  file: File;
  options?: UploadAssetOptions;
}): Promise<string> {
  validateAudioFileStrict(params.file, RELEASE_FILE_LIMITS.audioMaxMb);
  const path = getReleaseAudioPath(params.userId, params.releaseId);

  await removeStorageObjectsQuiet(STORAGE_BUCKET_AUDIO_LEGACY, [path]);

  try {
    await putObjectWithProgress(STORAGE_BUCKET_AUDIO_LEGACY, path, params.file, {
      upsert: true,
      onProgress: params.options?.onProgress
    });
  } catch (err) {
    if (params.options?.markReleaseFailedOnError?.releaseId) {
      await handleUploadFailure(
        params.options.markReleaseFailedOnError.releaseId,
        err,
        "Ошибка загрузки основного аудио"
      );
    }
    throw err;
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(STORAGE_BUCKET_AUDIO_LEGACY).getPublicUrl(path);

  return publicUrl;
}

export async function uploadReleaseArtwork(params: {
  userId: number;
  releaseId: string;
  file: File;
  options?: UploadAssetOptions;
}): Promise<string> {
  validateArtworkFileStrict(params.file, RELEASE_FILE_LIMITS.artworkMaxMb);

  const ext = params.file.type === "image/png" ? "png" : "jpg";
  const path = getReleaseArtworkPath(params.userId, params.releaseId, ext);

  const otherExt = ext === "png" ? "jpg" : "png";
  const otherPath = getReleaseArtworkPath(params.userId, params.releaseId, otherExt);
  await removeStorageObjectsQuiet(STORAGE_BUCKET_ARTWORK, [path, otherPath]);

  try {
    await putObjectWithProgress(STORAGE_BUCKET_ARTWORK, path, params.file, {
      upsert: true,
      onProgress: params.options?.onProgress
    });
  } catch (err) {
    if (params.options?.markReleaseFailedOnError?.releaseId) {
      await handleUploadFailure(
        params.options.markReleaseFailedOnError.releaseId,
        err,
        "Ошибка загрузки обложки"
      );
    }
    const wrapped = err instanceof Error ? err : new Error(String(err));
    throw new Error(`Ошибка загрузки обложки: ${wrapped.message}`);
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(STORAGE_BUCKET_ARTWORK).getPublicUrl(path);

  return publicUrl;
}

export async function uploadReleaseTrackAudio(params: {
  userId: number;
  releaseId: string;
  trackIndex: number;
  file: File;
  options?: UploadAssetOptions;
}): Promise<string> {
  validateAudioFileStrict(params.file, RELEASE_FILE_LIMITS.audioMaxMb);
  const path = getReleaseTrackAudioPath(params.userId, params.releaseId, params.trackIndex);

  await removeStorageObjectsQuiet(STORAGE_BUCKET_RELEASE_TRACKS, [path]);

  try {
    await uploadReleaseTrackFileClient(path, params.file, {
      onProgress: params.options?.onProgress
    });
  } catch (err) {
    if (params.options?.markReleaseFailedOnError?.releaseId) {
      await handleUploadFailure(
        params.options.markReleaseFailedOnError.releaseId,
        err,
        `Ошибка загрузки WAV трека #${params.trackIndex + 1}`
      );
    }
    throw err;
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(STORAGE_BUCKET_RELEASE_TRACKS).getPublicUrl(path);

  return publicUrl;
}

export async function deleteReleaseFiles(params: {
  userId: number;
  releaseId: string;
  trackCount?: number;
}): Promise<void> {
  const legacyAudioBucket = supabase.storage.from(STORAGE_BUCKET_AUDIO_LEGACY);
  const releasesTracksBucket = supabase.storage.from(STORAGE_BUCKET_RELEASE_TRACKS);
  const artworkBucket = supabase.storage.from(STORAGE_BUCKET_ARTWORK);

  const legacyAudioPath = getReleaseAudioPath(params.userId, params.releaseId);
  const trackPaths: string[] = [];
  if (params.trackCount && params.trackCount > 0) {
    for (let i = 0; i < params.trackCount; i += 1) {
      trackPaths.push(getReleaseTrackAudioPath(params.userId, params.releaseId, i));
    }
  }

  const legacyAudioRemove = [legacyAudioPath, ...trackPaths];

  await Promise.all([
    withRetry(async () => {
      const response = await legacyAudioBucket.remove(legacyAudioRemove);
      if (response.error) throw response.error;
      return response;
    }),
    trackPaths.length > 0
      ? withRetry(async () => {
          const response = await releasesTracksBucket.remove(trackPaths);
          if (response.error) throw response.error;
          return response;
        })
      : Promise.resolve(),
    withRetry(async () => {
      const response = await artworkBucket.remove([
        getReleaseArtworkPath(params.userId, params.releaseId, "jpg"),
        getReleaseArtworkPath(params.userId, params.releaseId, "png")
      ]);
      if (response.error) throw response.error;
      return response;
    })
  ]);
}
