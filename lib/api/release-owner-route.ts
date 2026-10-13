import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveReleaseActor } from "@/lib/api/resolve-submit-actor";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { isReleaseActorOwner, type ReleaseActor } from "@/lib/release-ownership.server";
import { getExpectedAdminTelegramId, telegramIdsEqual } from "@/lib/admin";

/**
 * Общий каркас для маршрутов владельца релиза: вместо RLS по заголовку `x-telegram-user-id`
 * (его может подставить любой клиент с anon-ключом) — проверенный actor (initData / cookie Supabase)
 * + service role + явная проверка владельца.
 */

/** Колонки, нужные для проверки владельца и статуса. */
export const RELEASE_OWNER_COLUMNS = "id, user_id, telegram_id, user_uuid, status";

/** Колонки треков для резюме черновика и карточки релиза. */
export const RELEASE_TRACKS_SELECT =
  "id, release_id, user_id, index, position, title, explicit, file_path, lyrics, duration";

/** Статусы, в которых владелец ещё может править релиз и треки. */
export const OWNER_EDITABLE_STATUSES = ["draft", "pending", "failed"] as const;

export function jsonError(status: number, error: string): Response {
  return NextResponse.json({ ok: false, error }, { status });
}

export type ActorContext = {
  actor: ReleaseActor;
  admin: SupabaseClient;
};

export type OwnedReleaseContext = ActorContext & {
  row: Record<string, unknown>;
};

type Result<T> = { ok: true; value: T } | { ok: false; response: Response };

/** Actor из initData / cookie + service role клиент. */
export async function resolveActorContext(request: NextRequest): Promise<Result<ActorContext>> {
  const actor = await resolveReleaseActor(request);
  if (!actor) {
    return { ok: false, response: jsonError(401, "Unauthorized") };
  }
  const admin = createSupabaseAdmin();
  if (!admin) {
    return {
      ok: false,
      response: jsonError(503, "SUPABASE_SERVICE_ROLE_KEY not configured")
    };
  }
  return { ok: true, value: { actor, admin } };
}

function isTelegramAdminActor(actor: ReleaseActor): boolean {
  if (actor.kind !== "telegram") return false;
  try {
    return telegramIdsEqual(actor.telegramUserId, getExpectedAdminTelegramId());
  } catch {
    return false;
  }
}

/**
 * Загружает релиз и проверяет, что actor — владелец (или Telegram-админ при `allowAdmin`).
 * 401 без сессии, 404 если релиза нет, 403 если чужой.
 */
export async function loadOwnedRelease(
  request: NextRequest,
  releaseId: string,
  options?: { columns?: string; allowAdmin?: boolean }
): Promise<Result<OwnedReleaseContext>> {
  const ctx = await resolveActorContext(request);
  if (!ctx.ok) return ctx;
  const { actor, admin } = ctx.value;

  const columns = options?.columns ?? RELEASE_OWNER_COLUMNS;
  const { data, error } = await admin.from("releases").select(columns).eq("id", releaseId).maybeSingle();
  if (error) {
    console.error("[release-owner-route] load:", error.message);
    return { ok: false, response: jsonError(500, "Не удалось загрузить релиз.") };
  }
  if (!data) {
    return { ok: false, response: jsonError(404, "Релиз не найден.") };
  }

  const row = data as unknown as Record<string, unknown>;
  const isOwner = await isReleaseActorOwner(admin, row, actor);
  if (!isOwner && !(options?.allowAdmin && isTelegramAdminActor(actor))) {
    return { ok: false, response: jsonError(403, "Нет доступа к этому релизу.") };
  }

  return { ok: true, value: { actor, admin, row } };
}

export function isOwnerEditableStatus(status: unknown): boolean {
  return (OWNER_EDITABLE_STATUSES as readonly string[]).includes(String(status ?? ""));
}

/** 409, если релиз уже на модерации или опубликован. */
export function rejectIfLocked(row: Record<string, unknown>): Response | null {
  if (isOwnerEditableStatus(row.status)) return null;
  return jsonError(409, "Релиз уже отправлен на проверку — изменения недоступны.");
}

export async function readJsonBody(request: NextRequest): Promise<Result<unknown>> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false, response: jsonError(400, "Invalid JSON") };
  }
}

/** Лог события релиза (service role; у клиента нет INSERT-политики на `release_logs`). */
export async function logReleaseEventServer(
  admin: SupabaseClient,
  params: {
    releaseId: string;
    stage: "create" | "upload" | "finalize" | "status" | "error";
    status: string;
    errorMessage?: string | null;
  }
): Promise<void> {
  const { error } = await admin.from("release_logs").insert({
    release_id: params.releaseId,
    stage: params.stage,
    status: params.status,
    error_message: params.errorMessage ?? null
  });
  if (error) {
    console.warn("[release-owner-route] release_logs insert:", error.message);
  }
}
