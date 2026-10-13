/** Разделы «Помощи» (/requirements?topic=…). Контент — в `components/library/faq-data.tsx`. */
export const FAQ_TOPIC_KEYS = [
  "audio",
  "cover",
  "release-date",
  "release-type",
  "collab",
  "metadata",
  "moderation",
  "wav-warning",
  "where-to-open"
] as const;

export type FaqTopicKey = (typeof FAQ_TOPIC_KEYS)[number];

export function parseFaqTopic(raw: string | null | undefined): FaqTopicKey | null {
  return (FAQ_TOPIC_KEYS as readonly string[]).includes(raw ?? "") ? (raw as FaqTopicKey) : null;
}
