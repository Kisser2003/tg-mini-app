import type { SupabaseClient } from "@supabase/supabase-js";
import { parseArtistLinksFromJson } from "@/lib/artist-links";
import type { AiModerationInput, AiModerationResult } from "@/lib/ai-metadata-moderation";
import {
  getGeminiMetadataModel,
  isGeminiModerationConfigured,
  moderateReleaseMetadataGemini
} from "@/lib/gemini-metadata-moderation";

export type AiPrecheckOutcome =
  | { allow: true; skippedAi: boolean }
  | {
      allow: false;
      status: 400;
      error: string;
      details: string[];
      confidence_score: number;
      ai_moderation: true;
    }
  | { allow: false; status: 503; error: string };

async function insertAiModerationLog(
  admin: SupabaseClient,
  params: {
    releaseId: string;
    telegramUserId: number;
    result: AiModerationResult;
    model: string;
  }
): Promise<void> {
  const { error } = await admin.from("ai_moderation_logs").insert({
    release_id: params.releaseId,
    user_id: params.telegramUserId,
    status: params.result.status,
    flagged_reasons: params.result.flagged_reasons,
    confidence_score: params.result.confidence_score,
    model: params.model
  });
  if (error) {
    console.error("[release-ai-moderation] ai_moderation_logs insert:", error.message);
  }
}

/**
 * Appends an AI pre-check line to \`admin_notes\` for moderator visibility (does not clear existing notes).
 */
async function appendAdminNotesForAiFlag(
  admin: SupabaseClient,
  releaseId: string,
  reasons: string[]
): Promise<void> {
  const line = `[AI metadata ${new Date().toISOString()}] ${reasons.join(" | ")}`;
  const { data: row, error: selErr } = await admin
    .from("releases")
    .select("admin_notes")
    .eq("id", releaseId)
    .maybeSingle();

  if (selErr) {
    console.error("[release-ai-moderation] admin_notes read:", selErr.message);
    return;
  }

  const prev =
    row && typeof (row as { admin_notes?: string | null }).admin_notes === "string"
      ? String((row as { admin_notes: string }).admin_notes).trim()
      : "";
  const next = prev.length > 0 ? `${prev}\n${line}` : line;

  const { error: upErr } = await admin
    .from("releases")
    .update({ admin_notes: next })
    .eq("id", releaseId);

  if (upErr) {
    console.error("[release-ai-moderation] admin_notes update:", upErr.message);
  }
}

export function buildAiModerationInput(params: {
  artist_name?: string | null;
  title?: string | null;
  track_name?: string | null;
  performance_language?: string | null;
  artist_links?: unknown;
  collaborators?: unknown;
  explicit?: boolean | null;
  is_explicit?: boolean | null;
  lyrics?: string | null;
  trackRows: Array<{ title?: string | null; explicit?: boolean | null }>;
}): AiModerationInput {
  const releaseTitle = String(params.title ?? params.track_name ?? "").trim();
  const primaryArtist = String(params.artist_name ?? "").trim();
  const trackTitles = params.trackRows.map((r) => String(r.title ?? "").trim());
  const trackExplicit = params.trackRows.map((r) => Boolean(r.explicit ?? false));
  const links = parseArtistLinksFromJson(params.artist_links);
  const explicit = Boolean(params.explicit ?? params.is_explicit ?? false);
  const lyrics = params.lyrics != null && String(params.lyrics).trim() !== "" ? String(params.lyrics) : null;

  return {
    releaseTitle,
    primaryArtist,
    trackTitles,
    trackExplicit,
    artistLinks: {
      spotify: links.spotify.trim(),
      apple: links.apple.trim(),
      yandex: links.yandex.trim(),
      vk: links.vk.trim()
    },
    collaborators: params.collaborators ?? null,
    explicit,
    lyrics
  };
}

/**
 * Runs Gemini metadata QA when \`GEMINI_API_KEY\` is set; otherwise skips (manual review path).
 * On \`flagged\`: logs to \`ai_moderation_logs\`, appends \`admin_notes\`, blocks finalization.
 */
export async function runAiMetadataPrecheck(
  admin: SupabaseClient,
  args: {
    releaseId: string;
    telegramUserId: number;
    input: AiModerationInput;
  }
): Promise<AiPrecheckOutcome> {
  if (!isGeminiModerationConfigured()) {
    return { allow: true, skippedAi: true };
  }

  const model = getGeminiMetadataModel();

  try {
    const result = await moderateReleaseMetadataGemini(args.input);
    await insertAiModerationLog(admin, {
      releaseId: args.releaseId,
      telegramUserId: args.telegramUserId,
      result,
      model
    });

    if (result.status === "flagged") {
      await appendAdminNotesForAiFlag(admin, args.releaseId, result.flagged_reasons);
      return {
        allow: false,
        status: 400,
        error:
          "Автоматическая проверка метаданных не пройдена. Исправьте замечания и отправьте снова.",
        details: result.flagged_reasons,
        confidence_score: result.confidence_score,
        ai_moderation: true
      };
    }

    return { allow: true, skippedAi: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[release-ai-moderation] Gemini error:", msg);
    /**
     * Не блокируем отправку релиза (ручная модерация), если:
     * - модель недоступна / переименована (404);
     * - квота или лимит free tier (429 RESOURCE_EXHAUSTED).
     */
    const skipPrecheck =
      /is not found for API version|models\/[\w.-]+ is not found|NOT_FOUND|"status":"NOT_FOUND"/i.test(
        msg
      ) ||
      /"code":429|"status":"RESOURCE_EXHAUSTED"|RESOURCE_EXHAUSTED|quota exceeded|exceeded your current quota|free_tier/i.test(
        msg
      );
    if (skipPrecheck) {
      console.warn(
        "[release-ai-moderation] AI precheck skipped (model/quota). Проверьте GEMINI_METADATA_MODEL и квоты: https://ai.google.dev/gemini-api/docs/rate-limits — релиз уходит без автопроверки."
      );
      return { allow: true, skippedAi: true };
    }
    return {
      allow: false,
      status: 503,
      error:
        "Сервис проверки метаданных временно недоступен. Подождите немного и попробуйте снова."
    };
  }
}

export async function runAiMetadataPrecheckForRelease(
  admin: SupabaseClient,
  releaseId: string,
  telegramUserId: number
): Promise<AiPrecheckOutcome | { allow: false; status: 500; error: string }> {
  const { data: releaseRow, error: relErr } = await admin
    .from("releases")
    .select(
      "artist_name, title, track_name, performance_language, artist_links, collaborators, explicit, is_explicit, lyrics"
    )
    .eq("id", releaseId)
    .maybeSingle();

  if (relErr) {
    console.error("[release-ai-moderation] load release:", relErr.message);
    return { allow: false, status: 500, error: "Не удалось загрузить релиз." };
  }
  if (!releaseRow) {
    return { allow: false, status: 500, error: "Релиз не найден." };
  }

  const { data: trackRows, error: trErr } = await admin
    .from("tracks")
    .select("title, index, explicit")
    .eq("release_id", releaseId)
    .order("index", { ascending: true });

  if (trErr) {
    console.error("[release-ai-moderation] tracks:", trErr.message);
    return { allow: false, status: 500, error: "Не удалось загрузить треки." };
  }

  const input = buildAiModerationInput({
    ...releaseRow,
    trackRows: trackRows ?? []
  });

  return runAiMetadataPrecheck(admin, { releaseId, telegramUserId, input });
}
