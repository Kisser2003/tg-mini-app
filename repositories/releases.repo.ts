import { z } from "zod";
import { supabase } from "../lib/supabase";
import { uploadToSupabaseStorageObject } from "../lib/storage-upload-client";
import {
  RELEASE_STATUS_VALUES,
  RELEASE_TYPE_VALUES,
  type ReleaseStatus,
  type ReleaseType
} from "../lib/db-enums";
import {
  getReleaseAudioPath,
  getReleaseArtworkPath,
  getReleaseTrackAudioPath
} from "../lib/storagePaths";

const releaseStatusSchema = z.enum(RELEASE_STATUS_VALUES);
export type { ReleaseStatus };

/** Лимиты и допустимые MIME (строгая проверка до загрузки в Storage) */
export const RELEASE_FILE_LIMITS = {
  audioMaxMb: 200,
  artworkMaxMb: 20
} as const;

/** WAV: только явные audio-типы или пустой type с расширением .wav */
export const ALLOWED_AUDIO_MIME = new Set(["audio/wav", "audio/x-wav", "audio/wave"]);

/** Обложка: только JPEG / PNG */
export const ALLOWED_ARTWORK_MIME = new Set(["image/jpeg", "image/png", "image/jpg"]);

export type ReleaseStep1Payload = {
  user_id: number;
  client_request_id: string;
  artist_name: string;
  track_name: string;
  release_type: ReleaseType;
  genre: string;
  release_date: string;
  explicit: boolean;
};

export type ReleaseStep2Payload = {
  isrc?: string | null;
  authors?: string | null;
  splits?: string | null;
};

export type ReleaseRecord = {
  id: string;
  user_id: number;
  client_request_id: string;
  artist_name: string;
  track_name: string;
  release_type: ReleaseType;
  genre: string;
  release_date: string;
  explicit: boolean;
  audio_url: string | null;
  artwork_url: string | null;
  status: ReleaseStatus;
  created_at: string;
  error_message?: string | null;
} & ReleaseStep2Payload;

const releaseStep1Schema = z.object({
  user_id: z.number().int().nonnegative(),
  client_request_id: z.string().uuid(),
  artist_name: z.string().min(1).max(256).trim(),
  track_name: z.string().min(1).max(256).trim(),
  release_type: z.enum(RELEASE_TYPE_VALUES),
  genre: z.string().min(1).max(128).trim(),
  release_date: z.string().min(1),
  explicit: z.boolean()
});

const releaseStep2Schema = z.object({
  isrc: z
    .string()
    .max(15)
    .trim()
    .optional()
    .nullable(),
  authors: z
    .string()
    .max(512)
    .trim()
    .optional()
    .nullable(),
  splits: z
    .string()
    .max(512)
    .trim()
    .optional()
    .nullable()
});

const trackInsertSchema = z.object({
  releaseId: z.string().min(1),
  index: z.number().int().nonnegative(),
  title: z.string().min(1).max(256).trim(),
  explicit: z.boolean(),
  audioUrl: z.string().url()
});

export type UploadAssetOptions = {
  /** 0–100, вызывается при XMLHttpRequest upload progress */
  onProgress?: (percent: number) => void;
  /**
   * При ошибке загрузки: перевести релиз в failed и записать error_message (и лог в release_logs).
   */
  markReleaseFailedOnError?: {
    releaseId: string;
  };
};

async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelayMs = 200): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      const delay = baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }
}

async function logReleaseEvent(params: {
  releaseId: string;
  stage: "create" | "upload" | "finalize" | "status" | "error";
  status: ReleaseStatus;
  errorMessage?: string | null;
}) {
  await withRetry(async () => {
    const { error } = await supabase.from("release_logs").insert({
      release_id: params.releaseId,
      stage: params.stage,
      status: params.status,
      error_message: params.errorMessage ?? null
    });

    if (error) {
      throw error;
    }

    return null;
  });
}

function humanizeUploadError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/**
 * Удаление объектов в Storage без фатала, если файла уже нет (освобождение места перед новой загрузкой).
 */
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

export async function markReleaseFailed(releaseId: string, errorMessage: string): Promise<ReleaseRecord> {
  const trimmed = errorMessage.trim().slice(0, 2000);
  const { data, error } = await withRetry(async () => {
    return await supabase
      .from("releases")
      .update({
        status: "failed" as ReleaseStatus,
        error_message: trimmed || "Ошибка загрузки или обработки."
      })
      .eq("id", releaseId)
      .select("*");
  });

  if (error) {
    throw error;
  }

  const rows = data as ReleaseRecord[] | null;
  if (!rows || rows.length === 0) {
    throw new Error(`Не удалось пометить релиз как failed (id: ${releaseId})`);
  }

  const record = rows[0];
  await logReleaseEvent({
    releaseId,
    stage: "error",
    status: "failed",
    errorMessage: trimmed
  }).catch(() => {});

  return record;
}

export async function createDraftRelease(
  payload: ReleaseStep1Payload
): Promise<ReleaseRecord> {
  const validated = releaseStep1Schema.parse(payload);

  const { data, error } = await withRetry(async () => {
    const response = await supabase
      .from("releases")
      .upsert(
        {
          ...validated,
          status: "draft" as ReleaseStatus
        },
        { onConflict: "client_request_id" }
      )
      .select("*");
    return response;
  });

  if (error) {
    throw error;
  }

  const rows = data as ReleaseRecord[] | null;
  if (!rows || rows.length === 0) {
    throw new Error("Upsert вернул 0 строк — проверьте RLS-политики таблицы releases");
  }

  const record = rows[0];
  await logReleaseEvent({
    releaseId: record.id,
    stage: "create",
    status: record.status
  }).catch(() => {});

  return record;
}

export async function updateRelease(
  id: string,
  payload: Partial<ReleaseStep1Payload & ReleaseStep2Payload> & {
    audio_url?: string | null;
    artwork_url?: string | null;
    status?: ReleaseStatus;
    error_message?: string | null;
  }
): Promise<ReleaseRecord> {
  const base: Partial<ReleaseStep1Payload & ReleaseStep2Payload> = {};

  if (payload.artist_name !== undefined) base.artist_name = payload.artist_name;
  if (payload.track_name !== undefined) base.track_name = payload.track_name;
  if (payload.release_type !== undefined) base.release_type = payload.release_type;
  if (payload.genre !== undefined) base.genre = payload.genre;
  if (payload.release_date !== undefined) base.release_date = payload.release_date;
  if (payload.explicit !== undefined) base.explicit = payload.explicit;
  if (payload.isrc !== undefined) base.isrc = payload.isrc;
  if (payload.authors !== undefined) base.authors = payload.authors;
  if (payload.splits !== undefined) base.splits = payload.splits;
  if (payload.status !== undefined) {
    releaseStatusSchema.parse(payload.status);
  }

  if (Object.keys(base).length > 0) {
    releaseStep1Schema
      .omit({ client_request_id: true, user_id: true })
      .partial()
      .parse(base);
    releaseStep2Schema.partial().parse(base);
  }

  const { data, error } = await withRetry(async () => {
    const response = await supabase
      .from("releases")
      .update(payload)
      .eq("id", id)
      .select("*");
    return response;
  });

  if (error) {
    throw error;
  }

  const rows = data as ReleaseRecord[] | null;
  if (!rows || rows.length === 0) {
    throw new Error(`Запись релиза не найдена (id: ${id})`);
  }

  const record = rows[0];
  await logReleaseEvent({
    releaseId: record.id,
    stage: "status",
    status: record.status
  }).catch(() => {});

  return record;
}

export type SubmitReleaseParams = {
  releaseId: string;
  clientRequestId: string;
};

/**
 * Финализация: RPC `finalize_release(p_release_id, p_client_request_id)` в одной транзакции
 * (статус + лог). Идемпотентность: повторный вызов при уже `processing`/`ready` возвращает строку без дублей.
 */
export async function submitRelease(params: SubmitReleaseParams): Promise<ReleaseRecord> {
  const parsedIds = z
    .object({
      releaseId: z.string().uuid(),
      clientRequestId: z.string().uuid()
    })
    .safeParse(params);

  if (!parsedIds.success) {
    throw new Error("Некорректные идентификаторы релиза (ожидается UUID для id и client_request_id).");
  }

  const { releaseId, clientRequestId } = parsedIds.data;

  const { data: rpcData, error: rpcError } = await withRetry(async () => {
    return await supabase.rpc("finalize_release", {
      p_release_id: releaseId,
      p_client_request_id: clientRequestId
    });
  });

  if (rpcError) {
    const isMissing =
      rpcError.message?.includes("could not find") ||
      rpcError.message?.includes("function") ||
      rpcError.code === "PGRST202";

    if (isMissing) {
      return finalizeReleaseFallback(params);
    }

    await logReleaseEvent({
      releaseId,
      stage: "error",
      status: "failed",
      errorMessage: rpcError.message
    }).catch(() => {});

    throw rpcError;
  }

  const rows = Array.isArray(rpcData) ? rpcData : rpcData ? [rpcData] : [];
  if (rows.length === 0) {
    return finalizeReleaseFallback({ releaseId, clientRequestId });
  }

  return rows[0] as ReleaseRecord;
}

async function finalizeReleaseFallback(params: SubmitReleaseParams): Promise<ReleaseRecord> {
  const { releaseId, clientRequestId } = params;

  const { data: existing, error: loadError } = await withRetry(async () => {
    return await supabase
      .from("releases")
      .select("*")
      .eq("id", releaseId)
      .eq("client_request_id", clientRequestId)
      .maybeSingle();
  });

  if (loadError) {
    throw loadError;
  }

  const row = existing as ReleaseRecord | null;
  if (!row) {
    throw new Error("Релиз не найден или client_request_id не совпадает.");
  }

  if (row.status === "processing" || row.status === "ready") {
    return row;
  }

  if (row.status !== "draft") {
    throw new Error(`Нельзя отправить релиз в модерацию из статуса «${row.status}».`);
  }

  const updated = await updateRelease(releaseId, {
    status: "processing",
    error_message: null
  });

  await logReleaseEvent({
    releaseId,
    stage: "finalize",
    status: updated.status
  }).catch(() => {});

  return updated;
}

function validateAudioFileStrict(file: File, maxSizeMb: number): void {
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > maxSizeMb) {
    throw new Error(`Аудио слишком большое. Максимум ${maxSizeMb} МБ.`);
  }
  const name = file.name.toLowerCase();
  const hasWavExt = name.endsWith(".wav");
  const mime = file.type.trim().toLowerCase();

  if (ALLOWED_AUDIO_MIME.has(mime)) {
    return;
  }
  if (mime.length === 0 && hasWavExt) {
    return;
  }
  if (mime === "application/octet-stream" && hasWavExt) {
    return;
  }

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

  await removeStorageObjectsQuiet("audio", [path]);

  try {
    await putObjectWithProgress("audio", path, params.file, {
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
  } = supabase.storage.from("audio").getPublicUrl(path);

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
  await removeStorageObjectsQuiet("artwork", [path, otherPath]);

  try {
    await putObjectWithProgress("artwork", path, params.file, {
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
  } = supabase.storage.from("artwork").getPublicUrl(path);

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

  await removeStorageObjectsQuiet("audio", [path]);

  try {
    await putObjectWithProgress("audio", path, params.file, {
      upsert: true,
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
  } = supabase.storage.from("audio").getPublicUrl(path);

  return publicUrl;
}

export async function addReleaseTrack(params: {
  releaseId: string;
  index: number;
  title: string;
  explicit: boolean;
  audioUrl: string;
}): Promise<void> {
  const validated = trackInsertSchema.parse(params);

  const { error } = await withRetry(async () => {
    const response = await supabase
      .from("release_tracks")
      .upsert(
        {
          release_id: validated.releaseId,
          index: validated.index,
          title: validated.title,
          explicit: validated.explicit,
          audio_url: validated.audioUrl
        },
        { onConflict: "release_id,index" }
      );
    return response;
  });

  if (error) {
    throw error;
  }
}

export async function deleteReleaseFiles(params: {
  userId: number;
  releaseId: string;
  trackCount?: number;
}): Promise<void> {
  const audioBucket = supabase.storage.from("audio");
  const artworkBucket = supabase.storage.from("artwork");

  const audioPaths: string[] = [getReleaseAudioPath(params.userId, params.releaseId)];
  if (params.trackCount && params.trackCount > 0) {
    for (let i = 0; i < params.trackCount; i += 1) {
      audioPaths.push(getReleaseTrackAudioPath(params.userId, params.releaseId, i));
    }
  }

  await Promise.all([
    withRetry(async () => {
      const response = await audioBucket.remove(audioPaths);
      if (response.error) throw response.error;
      return response;
    }),
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

export async function cleanupReleaseTracks(releaseId: string): Promise<void> {
  await withRetry(async () => {
    const response = await supabase
      .from("release_tracks")
      .delete()
      .eq("release_id", releaseId);
    if (response.error) throw response.error;
    return response;
  });
}

export async function getReleaseById(id: string): Promise<ReleaseRecord> {
  const { data, error } = await withRetry(async () => {
    const response = await supabase
      .from("releases")
      .select("*")
      .eq("id", id)
      .single();
    return response;
  });

  if (error || !data) {
    throw error ?? new Error("Failed to load release");
  }

  return data as ReleaseRecord;
}
