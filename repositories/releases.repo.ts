import { z } from "zod";
import { logSupabaseUpdateError } from "../lib/errors";
import { supabase } from "../lib/supabase";
import { uploadToSupabaseStorageObject } from "../lib/storage-upload-client";
import { uploadReleaseTrackFileClient } from "../lib/storage-track-upload-client";
import {
  STORAGE_BUCKET_ARTWORK,
  STORAGE_BUCKET_AUDIO_LEGACY,
  STORAGE_BUCKET_RELEASE_TRACKS
} from "../lib/storage-buckets";
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
  /** Дублирует Telegram id (для колонки `telegram_id` и RLS). */
  telegram_id: number;
  /** Логин без @; может быть null, если у аккаунта нет username. */
  telegram_username: string | null;
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
  /** Название релиза (актуальная колонка в БД). */
  title?: string | null;
  /** Legacy; может отсутствовать, если в БД только `title`. */
  track_name?: string | null;
  release_type: ReleaseType;
  genre: string;
  release_date: string;
  explicit: boolean;
  audio_url: string | null;
  artwork_url: string | null;
  status: ReleaseStatus;
  created_at: string;
  error_message?: string | null;
  /** Комментарий модератора при отклонении (показ в библиотеке). */
  admin_notes?: string | null;
  /** Пользователь начал загрузку WAV, не довёл до конца. */
  draft_upload_started?: boolean;
  /** У пользователя уже есть страницы артиста на DSP. */
  has_existing_profiles?: boolean;
  /** Ссылки на профили артиста (JSON). */
  artist_links?: Record<string, unknown> | null;
  /** Язык исполнения (RU, EN, …). */
  performance_language?: string | null;
  /** Участники релиза с ролями и ссылками (JSON). */
  collaborators?: unknown;
  telegram_id?: number | null;
  telegram_username?: string | null;
} & ReleaseStep2Payload;

/** Публичное название релиза: `title`, иначе legacy `track_name`. */
export function getReleaseDisplayTitle(
  r: Pick<ReleaseRecord, "title" | "track_name">
): string {
  const fromTitle = typeof r.title === "string" ? r.title.trim() : "";
  if (fromTitle.length > 0) return fromTitle;
  return String(r.track_name ?? "").trim();
}

const releaseStep1Schema = z.object({
  user_id: z.number().int().nonnegative(),
  telegram_id: z.number().int().positive(),
  telegram_username: z.union([z.string().max(64).trim(), z.null()]),
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
  userId: z.number().int().nonnegative(),
  index: z.number().int().nonnegative(),
  title: z.string().min(1).max(256).trim(),
  explicit: z.boolean(),
  /** Публичный URL после загрузки в Storage — в БД пишется в колонку `file_path`. */
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

/** PostgREST не должен получать ключи со значением `undefined` — ломает сериализацию/INSERT. */
function omitUndefinedFromRecord<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

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

  const { data: existingRow, error: loadError } = await withRetry(async () => {
    return await supabase
      .from("releases")
      .select("*")
      .eq("client_request_id", validated.client_request_id)
      .maybeSingle();
  });

  if (loadError) {
    logSupabaseUpdateError("createDraftRelease.load", loadError);
    throw loadError;
  }

  const existing = existingRow as ReleaseRecord | null;
  if (existing && (existing.status === "processing" || existing.status === "ready")) {
    throw new Error(
      "Релиз с этим идентификатором уже на проверке или опубликован — нельзя снова сохранить как черновик."
    );
  }

  const { track_name, telegram_id, telegram_username, ...rest } = validated;

  const { data, error } = await withRetry(async () => {
    const response = await supabase
      .from("releases")
      .upsert(
        {
          ...rest,
          telegram_id,
          telegram_username,
          title: track_name,
          status: "pending" as ReleaseStatus
        },
        { onConflict: "client_request_id" }
      )
      .select("*");
    return response;
  });

  if (error) {
    logSupabaseUpdateError("createDraftRelease.upsert", error);
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
    title?: string;
    audio_url?: string | null;
    artwork_url?: string | null;
    status?: ReleaseStatus;
    error_message?: string | null;
    admin_notes?: string | null;
    draft_upload_started?: boolean;
    has_existing_profiles?: boolean;
    artist_links?: Record<string, string> | Record<string, unknown>;
    performance_language?: string | null;
    collaborators?: Record<string, unknown>[] | unknown;
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

  const sanitized = omitUndefinedFromRecord(payload as Record<string, unknown>) as typeof payload;

  const { data, error } = await withRetry(async () => {
    const response = await supabase
      .from("releases")
      .update(sanitized)
      .eq("id", id)
      .select("*");
    return response;
  });

  if (error) {
    logSupabaseUpdateError("updateRelease", error);
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

  const { data: currentRow, error: currentErr } = await withRetry(async () => {
    return await supabase
      .from("releases")
      .select("*")
      .eq("id", releaseId)
      .eq("client_request_id", clientRequestId)
      .maybeSingle();
  });

  if (currentErr) {
    throw currentErr;
  }

  const current = currentRow as ReleaseRecord | null;
  if (current && (current.status === "processing" || current.status === "ready")) {
    return current;
  }

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

  if (row.status !== "draft" && row.status !== "pending") {
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

/**
 * Гарантирует статус `processing` в БД после финализации (RPC может расходиться с фактом).
 * Не трогает строки уже в `processing`/`ready`; для `draft` выполняет update по `id` + `client_request_id`.
 */
export async function ensureReleaseProcessing(
  releaseId: string,
  clientRequestId: string
): Promise<ReleaseRecord> {
  const parsed = z
    .object({
      releaseId: z.string().uuid(),
      clientRequestId: z.string().uuid()
    })
    .safeParse({ releaseId, clientRequestId });

  if (!parsed.success) {
    throw new Error("Некорректные идентификаторы релиза.");
  }

  let row = await getReleaseById(parsed.data.releaseId);

  if (row.client_request_id !== parsed.data.clientRequestId) {
    throw new Error("Не удалось отправить релиз на модерацию. Статус не изменен.");
  }

  if (row.status === "processing" || row.status === "ready") {
    return row;
  }

  if (row.status !== "draft" && row.status !== "pending") {
    throw new Error(`Нельзя отправить релиз в модерацию из статуса «${row.status}».`);
  }

  const { data, error } = await withRetry(async () => {
    return await supabase
      .from("releases")
      .update({ status: "processing", error_message: null })
      .eq("id", parsed.data.releaseId)
      .eq("client_request_id", parsed.data.clientRequestId)
      .in("status", ["draft", "pending"])
      .select("*");
  });

  if (error) {
    console.error("Критическая ошибка смены статуса:", error);
    throw new Error("Не удалось отправить релиз на модерацию. Статус не изменен.");
  }

  const rows = data as ReleaseRecord[] | null;
  if (!rows || rows.length === 0) {
    console.error("Критическая ошибка смены статуса: update returned 0 rows");
    throw new Error("Не удалось отправить релиз на модерацию. Статус не изменен.");
  }

  const updated = rows[0];
  if (updated.status !== "processing" && updated.status !== "ready") {
    throw new Error("Не удалось отправить релиз на модерацию. Статус не изменен.");
  }

  await logReleaseEvent({
    releaseId: parsed.data.releaseId,
    stage: "finalize",
    status: updated.status
  }).catch(() => {});

  row = await getReleaseById(parsed.data.releaseId);
  if (row.status !== "processing" && row.status !== "ready") {
    throw new Error("Не удалось отправить релиз на модерацию. Статус не изменен.");
  }

  return row;
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

export async function addReleaseTrack(params: {
  releaseId: string;
  userId: number;
  index: number;
  title: string;
  explicit: boolean;
  audioUrl: string;
}): Promise<void> {
  const validated = trackInsertSchema.parse(params);

  const { error } = await withRetry(async () => {
    const response = await supabase.from("tracks").upsert(
      {
        release_id: validated.releaseId,
        user_id: validated.userId,
        index: validated.index,
        title: validated.title,
        explicit: validated.explicit,
        file_path: validated.audioUrl
      },
      { onConflict: "release_id,index" }
    );
    return response;
  });

  if (error) {
    logSupabaseUpdateError("addReleaseTrack", error);
    throw error;
  }
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

  /** Старые WAV лежали в `audio`; новые — в `releases`. Чистим оба. */
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

export async function cleanupReleaseTracks(releaseId: string): Promise<void> {
  await withRetry(async () => {
    const response = await supabase.from("tracks").delete().eq("release_id", releaseId);
    if (response.error) throw response.error;
    return response;
  });
}

/** Строка таблицы `public.tracks` (см. миграцию 20260330120000_tracks_table.sql). */
export type ReleaseTrackRow = {
  id?: string;
  release_id: string;
  user_id?: number;
  index: number;
  title: string;
  explicit: boolean;
  /** Публичный URL аудио (в SQL колонка `file_path`). */
  file_path: string | null;
};

/**
 * Треки релиза из БД (для резюме черновика и отладки).
 * Сортировка по `index` по возрастанию.
 */
export async function getReleaseTracksByReleaseId(releaseId: string): Promise<ReleaseTrackRow[]> {
  const { data, error } = await withRetry(async () => {
    const response = await supabase
      .from("tracks")
      .select("id, release_id, user_id, index, title, explicit, file_path")
      .eq("release_id", releaseId)
      .order("index", { ascending: true });
    return response;
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as ReleaseTrackRow[];
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

/**
 * Все релизы пользователя для списка (библиотека). Без фильтра по статусу — видны draft, pending, processing и т.д.
 * В БД `user_id` / `telegram_id` могут быть TEXT — фильтр через строку, иначе PostgREST не совпадает с типом колонки.
 */
export async function getMyReleases(userId: number | string): Promise<ReleaseRecord[]> {
  const idStr = String(userId).trim();
  if (!idStr || idStr === "NaN") {
    return [];
  }
  const asNum = Number(idStr);
  if (!Number.isFinite(asNum) || asNum <= 0) {
    return [];
  }
  console.log("Fetching releases for ID:", idStr);
  const { data, error } = await withRetry(async () => {
    /**
     * Только `.select()` без `.single()` — массив строк.
     * Явный список колонок ломался при 42703 (колонка переименована/удалена в БД).
     * `*` возвращает только существующие поля; фильтр по `user_id` / `telegram_id` (snake_case).
     */
    return await supabase
      .from("releases")
      .select("*")
      .or(`user_id.eq.${idStr},telegram_id.eq.${idStr}`)
      .order("created_at", { ascending: false });
  });

  if (error) {
    console.error("Supabase Error:", error);
    logSupabaseUpdateError("getMyReleases", error);
    throw error;
  }

  return (data ?? []) as ReleaseRecord[];
}

/**
 * Очередь модерации: релизы на проверке (`processing` или `pending`, если статус не обновился до конца пайплайна).
 * Сортировка: сначала более ранние по дате создания.
 */
export async function getPendingReleases(): Promise<ReleaseRecord[]> {
  const { data, error } = await withRetry(async () => {
    const response = await supabase
      .from("releases")
      .select("*")
      .in("status", ["processing", "pending"])
      .order("created_at", { ascending: true });
    return response;
  });

  if (error) {
    logSupabaseUpdateError("getPendingReleases", error);
    throw error;
  }

  return (data ?? []) as ReleaseRecord[];
}

/** @alias getPendingReleases — очередь модерации для админки. */
export const getAdminReleases = getPendingReleases;

/**
 * Обновление статуса релиза (модерация: одобрение / отклонение).
 * Для `ready` очищает `error_message`; для `failed` записывает причину.
 */
export async function updateReleaseStatus(
  id: string,
  args: {
    status: Extract<ReleaseStatus, "ready" | "failed">;
    error_message?: string | null;
    /** Текст для пользователя в библиотеке (при отклонении). */
    admin_notes?: string | null;
  }
): Promise<ReleaseRecord> {
  if (args.status === "ready") {
    return updateRelease(id, { status: "ready", error_message: null, admin_notes: null });
  }
  const msg =
    (args.error_message && args.error_message.trim()) || "Отклонено модератором";
  const notes = (args.admin_notes && args.admin_notes.trim()) || msg;
  return updateRelease(id, { status: "failed", error_message: msg, admin_notes: notes });
}
