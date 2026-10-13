import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  jsonError,
  loadOwnedRelease,
  logReleaseEventServer,
  readJsonBody,
  rejectIfLocked
} from "@/lib/api/release-owner-route";
import { invalidateMyReleasesCache } from "@/lib/server/release-list-cache";

export const runtime = "nodejs";

const bodySchema = z.object({
  releaseId: z.string().uuid(),
  errorMessage: z.string().max(4000).optional()
});

/**
 * Пометить свой черновик как `failed` после сбоя загрузки/отправки.
 * Релиз на модерации или опубликованный не трогаем (409).
 */
async function handleMarkFailed(request: NextRequest): Promise<Response> {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) {
    return jsonError(400, "Некорректное тело запроса.");
  }
  const { releaseId } = parsed.data;
  const message =
    (parsed.data.errorMessage ?? "").trim().slice(0, 2000) || "Ошибка загрузки или обработки.";

  const owned = await loadOwnedRelease(request, releaseId);
  if (!owned.ok) return owned.response;
  const { admin, row } = owned.value;
  const locked = rejectIfLocked(row);
  if (locked) return locked;

  const { data, error } = await admin
    .from("releases")
    .update({ status: "failed", error_message: message })
    .eq("id", releaseId)
    .in("status", ["draft", "pending", "failed"])
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[releases/mark-failed] update:", error.message);
    return jsonError(500, "Не удалось обновить статус релиза.");
  }
  if (!data) {
    return jsonError(409, "Релиз уже отправлен на проверку — изменения недоступны.");
  }

  await logReleaseEventServer(admin, {
    releaseId,
    stage: "error",
    status: "failed",
    errorMessage: message
  });
  await invalidateMyReleasesCache(row);
  return NextResponse.json({ ok: true, record: data });
}

export const POST = handleMarkFailed;
