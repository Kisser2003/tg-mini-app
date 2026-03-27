import { GoogleGenAI } from "@google/genai";
import {
  GEMINI_MODERATION_RESPONSE_JSON_SCHEMA,
  MUSIC_DISTRIBUTOR_QA_SYSTEM_PROMPT,
  normalizeModerationResult,
  type AiModerationInput,
  type AiModerationResult
} from "@/lib/ai-metadata-moderation";

export function isGeminiModerationConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key.length > 0);
}

/**
 * Default for Google AI Studio + @google/genai (v1beta).
 * `gemini-1.5-flash` often returns 404 on current API — use 2.x flash.
 * Override with GEMINI_METADATA_MODEL (e.g. gemini-2.5-flash).
 */
export function getGeminiMetadataModel(): string {
  return process.env.GEMINI_METADATA_MODEL?.trim() || "gemini-2.0-flash";
}

function buildUserText(input: AiModerationInput): string {
  return `Evaluate this release metadata as JSON:\n${JSON.stringify(
    {
      release_title: input.releaseTitle,
      primary_artist: input.primaryArtist,
      track_titles: input.trackTitles,
      track_explicit: input.trackExplicit,
      artist_links: input.artistLinks,
      collaborators: input.collaborators,
      explicit: input.explicit,
      lyrics_excerpt:
        input.lyrics && input.lyrics.length > 4000
          ? `${input.lyrics.slice(0, 4000)}…`
          : input.lyrics
    },
    null,
    0
  )}`;
}

/**
 * Gemini generateContent with structured JSON via \`responseJsonSchema\` (see also \`responseSchema\` in SDK).
 */
export async function moderateReleaseMetadataGemini(
  input: AiModerationInput
): Promise<AiModerationResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const model = getGeminiMetadataModel();
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: buildUserText(input),
    config: {
      systemInstruction: MUSIC_DISTRIBUTOR_QA_SYSTEM_PROMPT,
      temperature: 0.2,
      responseMimeType: "application/json",
      responseJsonSchema: GEMINI_MODERATION_RESPONSE_JSON_SCHEMA
    }
  });

  const text = response.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Gemini returned empty response text");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Gemini response was not valid JSON");
  }

  const normalized = normalizeModerationResult(parsedJson);
  if (!normalized) {
    throw new Error("Gemini JSON did not match moderation schema");
  }
  return normalized;
}
