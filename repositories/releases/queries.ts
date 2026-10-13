import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { logSupabaseUpdateError } from "../../lib/errors";
import { releaseApiRequest } from "../../lib/api/release-client";
import type { Database } from "@/types/database.types";
import { RELEASE_STATUS_VALUES, RELEASE_TYPE_VALUES } from "../../lib/db-enums";
import type { ReleaseRecord, ReleaseStatus, ReleaseTrackRow, ReleaseType } from "./types";

/*
 * Чтение и запись своих релизов идут через API владельца (`/api/releases/*`, service role +
 * проверка initData / cookie-сессии). Прямой доступ к `releases`/`tracks` через anon-ключ закрыт RLS.
 */

const releaseStatusSchema = z.enum(RELEASE_STATUS_VALUES);

const createDraftSchema = z.object({
  client_request_id: z.string().uuid(),
  artist_name: z.string().min(1).max(256).trim(),
  track_name: z.string().min(1).max(256).trim(),
  release_type: z.enum(RELEASE_TYPE_VALUES),
  genre: z.string().min(1).max(128).trim(),
  release_date: z.string().min(1),
  explicit: z.boolean()
});

export type CreateDraftReleaseInput = z.input<typeof createDraftSchema>;

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

export async function markReleaseFailed(releaseId: string, errorMessage: string): Promise<ReleaseRecord> {
  const { record } = await releaseApiRequest<{ ok: true; record: ReleaseRecord }>(
    "/api/releases/mark-failed",
    { method: "POST", body: { releaseId, errorMessage: errorMessage.trim().slice(0, 2000) } }
  );
  return record;
}

/**
 * Черновик (или обновление по `client_request_id`). Владельца сервер берёт из сессии
 * (Telegram initData или веб-cookie), а не из тела запроса.
 */
export async function createDraftRelease(input: CreateDraftReleaseInput): Promise<ReleaseRecord> {
  const validated = createDraftSchema.parse(input);
  const { record } = await releaseApiRequest<{ ok: true; record: ReleaseRecord }>(
    "/api/releases/create-draft",
    { method: "POST", body: validated }
  );
  return record;
}

export type UpdateReleasePatch = {
  artist_name?: string;
  title?: string;
  release_type?: ReleaseType;
  genre?: string;
  release_date?: string;
  explicit?: boolean;
  isrc?: string | null;
  artwork_url?: string | null;
  status?: Extract<ReleaseStatus, "draft" | "pending">;
  error_message?: null;
  artist_links?: Record<string, unknown> | null;
  performance_language?: string | null;
  collaborators?: unknown;
  lyrics?: string | null;
};

/** Частичное обновление своего черновика (`/api/releases/save-draft-patch`, allowlist колонок). */
export async function updateRelease(
  id: string,
  payload: UpdateReleasePatch,
  options?: { keepalive?: boolean }
): Promise<ReleaseRecord> {
  if (payload.status !== undefined) {
    releaseStatusSchema.parse(payload.status);
  }
  const patch = omitUndefinedFromRecord(payload as Record<string, unknown>);
  const { record } = await releaseApiRequest<{ ok: true; record: ReleaseRecord }>(
    "/api/releases/save-draft-patch",
    { method: "POST", body: { releaseId: id, patch }, keepalive: options?.keepalive }
  );
  return record;
}

export async function getReleaseById(id: string): Promise<ReleaseRecord> {
  const { record } = await releaseApiRequest<{ ok: true; record: ReleaseRecord }>(
    `/api/releases/${encodeURIComponent(id)}`
  );
  return record;
}

/** Релиз вместе с треками (отсортированы по `index`). */
export async function getReleaseWithTracks(
  id: string
): Promise<{ record: ReleaseRecord; tracks: ReleaseTrackRow[] }> {
  const { record, tracks } = await releaseApiRequest<{
    ok: true;
    record: ReleaseRecord;
    tracks: ReleaseTrackRow[];
  }>(`/api/releases/${encodeURIComponent(id)}?tracks=1`);
  return { record, tracks: tracks ?? [] };
}

/** Последний незавершённый черновик текущего пользователя (для «Продолжить»). */
export async function getLatestDraftReleaseId(): Promise<string | null> {
  const { releaseId } = await releaseApiRequest<{ ok: true; releaseId: string | null }>(
    "/api/releases/latest-draft"
  );
  return releaseId ?? null;
}

/**
 * Список релизов для веб-пользователя (email/password): запрос с JWT из браузерного клиента.
 * RLS (`user_uuid = auth.uid()`) отфильтрует строки.
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
