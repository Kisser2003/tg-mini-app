import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { logSupabaseUpdateError } from "../../lib/errors";
import { supabase } from "../../lib/supabase";
import type { Database } from "@/types/database.types";
import { RELEASE_STATUS_VALUES, RELEASE_TYPE_VALUES } from "../../lib/db-enums";
import type {
  ReleaseRecord,
  ReleaseStatus,
  ReleaseStep1Payload,
  ReleaseStep2Payload,
  ReleaseType,
  SubmitReleaseParams
} from "./types";

const releaseStatusSchema = z.enum(RELEASE_STATUS_VALUES);

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
  isrc: z.string().max(15).trim().optional().nullable(),
  authors: z.string().max(512).trim().optional().nullable(),
  splits: z.string().max(512).trim().optional().nullable()
});

/** PostgREST не должен получать ключи со значением `undefined` — ломает сериализацию/INSERT. */
function omitUndefinedFromRecord<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelayMs = 200): Promise<T> {
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

export async function logReleaseEvent(params: {
  releaseId: string;
  stage: "create" | "upload" | "finalize" | "status" | "error";
  status: ReleaseStatus;
  errorMessage?: string | null;
}): Promise<void> {
  await withRetry(async () => {
    const { error } = await supabase.from("release_logs").insert({
      release_id: params.releaseId,
      stage: params.stage,
      status: params.status,
      error_message: params.errorMessage ?? null
    });
    if (error) throw error;
    return null;
  });
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

  if (error) throw error;

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
          user_id: String(rest.user_id),
          telegram_id: String(telegram_id),
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

const createDraftWebSchema = z.object({
  syntheticUserId: z.number().int().positive(),
  authUserUuid: z.string().uuid(),
  client_request_id: z.string().uuid(),
  artist_name: z.string().min(1).max(256).trim(),
  track_name: z.string().min(1).max(256).trim(),
  release_type: z.enum(RELEASE_TYPE_VALUES),
  genre: z.string().min(1).max(128).trim(),
  release_date: z.string().min(1),
  explicit: z.boolean()
});

/**
 * Черновик для веб-сессии (email) без Telegram: владелец по `user_uuid` (RLS), пути Storage — synthetic id.
 */
export async function createDraftReleaseWeb(
  input: z.infer<typeof createDraftWebSchema>
): Promise<ReleaseRecord> {
  const v = createDraftWebSchema.parse(input);

  const { data: existingRow, error: loadError } = await withRetry(async () => {
    return await supabase
      .from("releases")
      .select("*")
      .eq("client_request_id", v.client_request_id)
      .maybeSingle();
  });

  if (loadError) {
    logSupabaseUpdateError("createDraftReleaseWeb.load", loadError);
    throw loadError;
  }

  const existing = existingRow as ReleaseRecord | null;
  if (existing && (existing.status === "processing" || existing.status === "ready")) {
    throw new Error(
      "Релиз с этим идентификатором уже на проверке или опубликован — нельзя снова сохранить как черновик."
    );
  }

  const { data, error } = await withRetry(async () => {
    const response = await supabase
      .from("releases")
      .upsert(
        {
          user_id: String(v.syntheticUserId),
          telegram_id: null,
          user_uuid: v.authUserUuid,
          client_request_id: v.client_request_id,
          artist_name: v.artist_name,
          title: v.track_name,
          release_type: v.release_type as ReleaseType,
          genre: v.genre,
          release_date: v.release_date,
          explicit: v.explicit,
          telegram_username: null,
          status: "pending" as ReleaseStatus
        },
        { onConflict: "client_request_id" }
      )
      .select("*");
    return response;
  });

  if (error) {
    logSupabaseUpdateError("createDraftReleaseWeb.upsert", error);
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
      // Json / Partial доменного типа шире, чем Insert — приводим для PostgREST.
      .update(sanitized as never)
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

  if (currentErr) throw currentErr;

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

  if (loadError) throw loadError;

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
 * Все релизы пользователя для списка (библиотека).
 */
export async function getMyReleases(userId: number | string): Promise<ReleaseRecord[]> {
  const idStr = String(userId).trim();
  if (!idStr || idStr === "NaN") return [];
  const asNum = Number(idStr);
  if (!Number.isFinite(asNum) || asNum <= 0) return [];

  const { data, error } = await withRetry(async () => {
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
 * Список релизов для веб-пользователя (email/password): запрос с JWT из браузерного клиента.
 * RLS (`user_uuid = auth.uid()`) отфильтрует строки; anon + x-telegram-user-id тут не используется.
 */
export async function getMyReleasesForWebUser(
  client: SupabaseClient<Database>
): Promise<ReleaseRecord[]> {
  const {
    data: { user }
  } = await client.auth.getUser();
  if (!user?.id) return [];

  const { data, error } = await withRetry(async () => {
    return await client
      .from("releases")
      .select("*")
      .eq("user_uuid", user.id)
      .order("created_at", { ascending: false });
  });

  if (error) {
    console.error("Supabase Error:", error);
    logSupabaseUpdateError("getMyReleasesForWebUser", error);
    throw error;
  }

  return (data ?? []) as unknown as ReleaseRecord[];
}

/**
 * Очередь модерации: релизы на проверке (`processing` или `pending`).
 * Для UI админки используйте GET `/api/admin/moderation-queue` (service role), а не этот метод —
 * иначе доступ зависит от RLS с заголовком `x-telegram-user-id`.
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
 */
export async function updateReleaseStatus(
  id: string,
  args: {
    status: Extract<ReleaseStatus, "ready" | "failed">;
    error_message?: string | null;
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
