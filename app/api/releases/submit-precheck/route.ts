import { NextResponse } from "next/server";
import { z } from "zod";
import type { NextRequest } from "next/server";
import type { TelegramAuthContext } from "@/lib/api/with-telegram-auth";
import { withTelegramAuth } from "@/lib/api/with-telegram-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { RELEASE_TYPE_VALUES, type ReleaseType } from "@/lib/db-enums";
import {
  collectReleaseArtistLinkErrors,
  validateMetadata,
  type ReleaseMetadata
} from "@/lib/metadata-validator";
import { parseArtistLinksFromJson } from "@/lib/artist-links";
import { parsePerformanceLanguage } from "@/lib/performance-language";

const bodySchema = z.object({
  releaseId: z.string().uuid(),
  clientRequestId: z.string().uuid(),
  declaredTrackCount: z.number().int().min(1)
});

function releaseTypeTrackRuleMessage(releaseType: ReleaseType, count: number): string | null {
  if (releaseType === "single") {
    return count === 1 ? null : "Для single должен быть ровно один трек.";
  }
  if (releaseType === "ep" || releaseType === "album") {
    return count >= 2 ? null : "Для EP или альбома нужно не менее двух треков.";
  }
  return null;
}

async function handleSubmitPrecheck(
  request: NextRequest,
  ctx: TelegramAuthContext
): Promise<Response> {
  const admin = createSupabaseAdmin();
  if (!admin) {
    console.error("[releases/submit-precheck] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Некорректное тело запроса." },
      { status: 400 }
    );
  }

  const { releaseId, clientRequestId, declaredTrackCount } = parsed.data;
  const telegramUserId = ctx.user.id;

  console.log("Submit attempt by user:", telegramUserId, "for release:", releaseId);

  const { data: releaseRow, error: relErr } = await admin
    .from("releases")
    .select(
      "id, user_id, client_request_id, release_type, artist_name, track_name, collaborators, performance_language, artist_links"
    )
    .eq("id", releaseId)
    .maybeSingle();

  if (relErr) {
    console.error("[releases/submit-precheck] releases:", relErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить релиз." }, { status: 500 });
  }

  if (!releaseRow) {
    return NextResponse.json({ ok: false, error: "Релиз не найден." }, { status: 404 });
  }

  const ownerId = Number(releaseRow.user_id);
  if (!Number.isFinite(ownerId) || ownerId !== telegramUserId) {
    return NextResponse.json({ ok: false, error: "Нет доступа к этому релизу." }, { status: 403 });
  }

  if (releaseRow.client_request_id !== clientRequestId) {
    return NextResponse.json(
      { ok: false, error: "Идентификатор запроса не совпадает с релизом." },
      { status: 400 }
    );
  }

  const releaseType = releaseRow.release_type as ReleaseType;
  if (!RELEASE_TYPE_VALUES.includes(releaseType)) {
    return NextResponse.json({ ok: false, error: "Неизвестный тип релиза." }, { status: 400 });
  }

  const { count: dbCount, error: cntErr } = await admin
    .from("tracks")
    .select("*", { count: "exact", head: true })
    .eq("release_id", releaseId);

  if (cntErr) {
    console.error("[releases/submit-precheck] tracks count:", cntErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось проверить треки." }, { status: 500 });
  }

  const n = dbCount ?? 0;
  if (n !== declaredTrackCount) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Число загруженных треков не совпадает с данными релиза. Обновите страницу и попробуйте снова."
      },
      { status: 400 }
    );
  }

  const typeMsg = releaseTypeTrackRuleMessage(releaseType, n);
  if (typeMsg) {
    return NextResponse.json({ ok: false, error: typeMsg }, { status: 400 });
  }

  const { data: trackRows, error: trErr } = await admin
    .from("tracks")
    .select("title, index")
    .eq("release_id", releaseId)
    .order("index", { ascending: true });

  if (trErr) {
    console.error("[releases/submit-precheck] tracks titles:", trErr.message);
    return NextResponse.json({ ok: false, error: "Не удалось загрузить названия треков." }, { status: 500 });
  }

  const row = releaseRow as {
    artist_name?: string | null;
    track_name?: string | null;
    performance_language?: string | null;
    artist_links?: unknown;
  };

  const meta: ReleaseMetadata = {
    primaryArtist: String(row.artist_name ?? "").trim(),
    releaseTitle: String(row.track_name ?? "").trim(),
    trackTitles: (trackRows ?? []).map((r) => String((r as { title: string }).title ?? "")),
    language: parsePerformanceLanguage(row.performance_language),
    releaseArtistLinks: parseArtistLinksFromJson(row.artist_links)
  };

  const dsp = validateMetadata(meta);
  if (!dsp.isValid) {
    return NextResponse.json(
      {
        ok: false,
        error:
          dsp.errors[0] ??
          "Метаданные не соответствуют требованиям площадок. Исправьте названия и повторите отправку.",
        details: dsp.errors
      },
      { status: 400 }
    );
  }

  const linkErrors = collectReleaseArtistLinkErrors(meta.releaseArtistLinks);
  if (linkErrors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          linkErrors[0] ??
          "Проверьте ссылки на профили артиста (необходим корректный https://…).",
        details: linkErrors
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

export const POST = withTelegramAuth(handleSubmitPrecheck);
