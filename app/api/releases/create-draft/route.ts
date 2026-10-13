import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  jsonError,
  logReleaseEventServer,
  readJsonBody,
  rejectIfLocked,
  resolveActorContext
} from "@/lib/api/release-owner-route";
import { getTelegramAuthContextFromRequest } from "@/lib/api/with-telegram-auth";
import { isReleaseActorOwner } from "@/lib/release-ownership.server";
import { stableNumericIdFromAuthUserId } from "@/lib/stable-web-user-id";
import { invalidateMyReleasesCache } from "@/lib/server/release-list-cache";
import { formatErrorMessage } from "@/lib/errors";
import { RELEASE_TYPE_VALUES } from "@/lib/db-enums";

export const runtime = "nodejs";

const bodySchema = z.object({
  client_request_id: z.string().uuid(),
  artist_name: z.string().trim().min(1).max(256),
  track_name: z.string().trim().min(1).max(256),
  release_type: z.enum(RELEASE_TYPE_VALUES),
  genre: z.string().trim().min(1).max(128),
  release_date: z.string().min(1).max(32),
  explicit: z.boolean()
});

/**
 * Создать (или обновить по `client_request_id`) черновик релиза.
 * Владелец (`user_id` / `telegram_id` / `user_uuid`) берётся только из проверенной сессии, не из тела.
 */
async function handleCreateDraft(request: NextRequest): Promise<Response> {
  const ctx = await resolveActorContext(request);
  if (!ctx.ok) return ctx.response;
  const { actor, admin } = ctx.value;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) {
    return jsonError(400, "Некорректное тело запроса.");
  }
  const input = parsed.data;

  let identity: {
    user_id: string;
    telegram_id: string | null;
    telegram_username: string | null;
    user_uuid?: string;
  };
  if (actor.kind === "telegram") {
    const username = getTelegramAuthContextFromRequest(request)?.user.username?.trim();
    identity = {
      user_id: String(actor.telegramUserId),
      telegram_id: String(actor.telegramUserId),
      telegram_username: username ? username.slice(0, 64) : null
    };
  } else {
    const { data: profile } = await admin
      .from("users")
      .select("telegram_id")
      .eq("id", actor.authUserId)
      .maybeSingle();
    const linkedTg = Number((profile as { telegram_id?: unknown } | null)?.telegram_id);
    const hasLinkedTg = Number.isFinite(linkedTg) && linkedTg > 0;
    identity = {
      user_id: String(hasLinkedTg ? Math.trunc(linkedTg) : stableNumericIdFromAuthUserId(actor.authUserId)),
      telegram_id: hasLinkedTg ? String(Math.trunc(linkedTg)) : null,
      telegram_username: null,
      user_uuid: actor.authUserId
    };
  }

  const fields = {
    artist_name: input.artist_name,
    title: input.track_name,
    release_type: input.release_type,
    genre: input.genre,
    release_date: input.release_date,
    explicit: input.explicit,
    status: "pending" as const
  };

  const { data: existing, error: loadErr } = await admin
    .from("releases")
    .select("id, user_id, telegram_id, user_uuid, status")
    .eq("client_request_id", input.client_request_id)
    .maybeSingle();
  if (loadErr) {
    console.error("[releases/create-draft] load:", loadErr.message);
    return jsonError(500, "Не удалось создать черновик.");
  }

  let record: Record<string, unknown> | null = null;
  if (existing) {
    const row = existing as Record<string, unknown>;
    if (!(await isReleaseActorOwner(admin, row, actor))) {
      return jsonError(403, "Нет доступа к этому релизу.");
    }
    const locked = rejectIfLocked(row);
    if (locked) return locked;

    const { data, error } = await admin
      .from("releases")
      .update(fields)
      .eq("id", String(row.id))
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("[releases/create-draft] update:", error.message);
      return jsonError(500, formatErrorMessage(error, "Не удалось создать черновик."));
    }
    record = data as Record<string, unknown> | null;
  } else {
    const { data, error } = await admin
      .from("releases")
      .insert({ ...fields, ...identity, client_request_id: input.client_request_id })
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("[releases/create-draft] insert:", error.message);
      return jsonError(500, formatErrorMessage(error, "Не удалось создать черновик."));
    }
    record = data as Record<string, unknown> | null;
  }

  if (!record) {
    return jsonError(500, "Не удалось создать черновик.");
  }

  await logReleaseEventServer(admin, {
    releaseId: String(record.id),
    stage: "create",
    status: String(record.status ?? "pending")
  });
  await invalidateMyReleasesCache(record);
  return NextResponse.json({ ok: true, record });
}

export const POST = handleCreateDraft;
