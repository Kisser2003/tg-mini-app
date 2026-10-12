import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { resolveReleaseActor } from "@/lib/api/resolve-submit-actor";
import { isReleaseActorOwner } from "@/lib/release-ownership.server";
import { MAX_WAV_MB } from "@/lib/storage-buckets";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getReleaseTrackAudioPath } from "@/lib/storagePaths";

export const runtime = "nodejs";

const clientPayloadSchema = z.object({
  releaseId: z.string().uuid(),
  trackIndex: z.number().int().min(0).max(99)
});

const WAV_CONTENT_TYPES = ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"];

/**
 * Выдаёт токен клиентской загрузки WAV в Vercel Blob (файл идёт из браузера напрямую, мимо функции).
 * Токен привязан к одному пути, ограничен по размеру и типу; проверяется владелец релиза и статус черновика.
 * События «загрузка завершена» от Vercel проверяются подписью внутри handleUpload.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const actor = await resolveReleaseActor(request);
        if (!actor) throw new Error("Unauthorized");

        const parsed = clientPayloadSchema.safeParse(
          (() => {
            try {
              return JSON.parse(clientPayload ?? "{}");
            } catch {
              return null;
            }
          })()
        );
        if (!parsed.success) throw new Error("Некорректные параметры загрузки.");
        const { releaseId, trackIndex } = parsed.data;

        const admin = createSupabaseAdmin();
        if (!admin) throw new Error("Server misconfigured");

        const { data: row, error } = await admin
          .from("releases")
          .select("id, user_id, telegram_id, user_uuid, status")
          .eq("id", releaseId)
          .maybeSingle();
        if (error || !row) throw new Error("Релиз не найден.");
        if (!(await isReleaseActorOwner(admin, row as Record<string, unknown>, actor))) {
          throw new Error("Нет доступа к этому релизу.");
        }
        const status = String(row.status ?? "");
        if (status !== "draft" && status !== "pending" && status !== "failed") {
          throw new Error("Файлы можно менять только у черновика.");
        }
        if (status === "failed") {
          // Прошлая загрузка упала: возвращаем релиз в черновик, чтобы его можно было дозагрузить и отправить.
          await admin.from("releases").update({ status: "draft", error_message: null }).eq("id", releaseId);
        }

        const ownerSegment = Number(row.user_id ?? row.telegram_id);
        if (!Number.isFinite(ownerSegment) || ownerSegment <= 0) {
          throw new Error("Не удалось определить владельца релиза.");
        }
        const expectedPath = getReleaseTrackAudioPath(Math.trunc(ownerSegment), releaseId, trackIndex);
        if (pathname !== expectedPath) throw new Error("Недопустимый путь файла.");

        return {
          allowedContentTypes: WAV_CONTENT_TYPES,
          maximumSizeInBytes: MAX_WAV_MB * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: true,
          // Файл по этому пути перезаписывается при замене трека: короткий кэш, чтобы не отдавать старый.
          cacheControlMaxAge: 60
        };
      }
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[audio-blob-token] failed", e instanceof Error ? e.message : e);
    const message = e instanceof Error ? e.message : "Не удалось подготовить загрузку.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
