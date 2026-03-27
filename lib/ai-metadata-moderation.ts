import { z } from "zod";

export const aiModerationResultSchema = z.object({
  status: z.enum(["approved", "flagged"]),
  flagged_reasons: z.array(z.string()),
  confidence_score: z.number()
});

export type AiModerationResult = z.infer<typeof aiModerationResultSchema>;

export type AiModerationInput = {
  releaseTitle: string;
  primaryArtist: string;
  trackTitles: string[];
  /** Per-track explicit flags (same order as track_titles). */
  trackExplicit: boolean[];
  artistLinks: Record<string, string>;
  collaborators: unknown;
  explicit: boolean;
  lyrics: string | null;
};

/**
 * Strict distributor QA: streaming-style rules (capitalization, no emojis in titles,
 * explicit flag vs lyrical content, prohibited promo / misleading patterns).
 */
export const MUSIC_DISTRIBUTOR_QA_SYSTEM_PROMPT = `You are a digital music distributor quality assurance reviewer. Your job is to evaluate release metadata for compliance with common streaming platform distribution rules (Spotify, Apple Music, YouTube Music style policies).

Evaluate ONLY the user-provided JSON payload. Do not invent facts not present in the data.

Rules you MUST enforce:
1. **Titles and names**: Primary release title and track titles should use conventional capitalization (not ALL CAPS unless clearly intentional stylization like known brands). No leading/trailing whitespace issues (assume trimmed). No emoji characters in titles or artist-visible strings.
2. **Artist links**: If a platform key is present with a non-empty URL, it should look like a normal profile URL for that platform (https, plausible path). Flag obviously malformed, placeholder, or non-URL text. Empty strings are acceptable (not provided).
3. **Collaborators**: If collaborators are listed, names should be plausible human artist names; flag obvious spam, URLs as names, or abusive content.
4. **Explicit flag**: The release has \`explicit\` (release-level) and \`track_explicit\` (per track, aligned with \`track_titles\`). If any track is explicit but the release is marked non-explicit (or the opposite pattern is clearly inconsistent), flag. If \`explicit\` is false but \`lyrics\` or combined track/release titles contain strong profanity or clearly explicit sexual/violent themes typically requiring an explicit label, flag as mismatch. If explicit is true, do not flag solely for profanity in lyrics. If lyrics are empty/null, rely on titles, track explicit flags, and collaborator fields for explicit mismatch.
5. **Prohibited / misleading**: Flag misleading use of another artist's trademarked name as the primary artist, obvious promotional abuse ("FREE DOWNLOAD", "CLICK HERE"), or metadata that appears designed to game search/discovery.

Output policy:
- Return \`status\`: "approved" only if there are no material violations.
- Return \`status\`: "flagged" if any material violation exists; populate \`flagged_reasons\` with short, actionable strings in English (each reason one issue).
- If approved, \`flagged_reasons\` MUST be an empty array.
- \`confidence_score\` is a number from 0 to 1 (1 = very confident in your judgment).

Be conservative: when unsure, prefer "flagged" with a clear reason rather than approving borderline misleading metadata.`;

/** JSON Schema for Gemini \`responseJsonSchema\` / \`responseSchema\` (structured output). */
export const GEMINI_MODERATION_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ["approved", "flagged"],
      description: "approved if metadata passes QA; flagged if any issue must be fixed."
    },
    flagged_reasons: {
      type: "array",
      items: { type: "string" },
      description: "Empty when approved; otherwise human-readable issues."
    },
    confidence_score: {
      type: "number",
      description: "Confidence from 0 to 1."
    }
  },
  required: ["status", "flagged_reasons", "confidence_score"]
} as const;

export function normalizeModerationResult(raw: unknown): AiModerationResult | null {
  const parsed = aiModerationResultSchema.safeParse(raw);
  if (!parsed.success) return null;
  const v = parsed.data;
  let reasons = v.flagged_reasons.map((s) => s.trim()).filter((s) => s.length > 0);
  let status = v.status;
  if (status === "flagged" && reasons.length === 0) {
    reasons = ["Metadata failed automated QA review (no specific reason returned)."];
  }
  if (status === "approved" && reasons.length > 0) {
    status = "flagged";
  }
  let score = v.confidence_score;
  if (!Number.isFinite(score)) score = 0;
  if (score > 1 && score <= 100) score = score / 100;
  score = Math.min(1, Math.max(0, score));
  return { status, flagged_reasons: reasons, confidence_score: score };
}
