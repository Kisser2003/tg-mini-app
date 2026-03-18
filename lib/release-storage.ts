import type { ModerationQueueItem } from "@/types/release";

export const RELEASE_DRAFT_STORAGE_KEY = "omf.release.wizard.draft.v1";
export const MODERATION_QUEUE_STORAGE_KEY = "omf.release.submitted.v1";

export function readModerationQueue(): ModerationQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MODERATION_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ModerationQueueItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.artist === "string"
    );
  } catch {
    return [];
  }
}

export function appendModerationQueue(item: ModerationQueueItem) {
  if (typeof window === "undefined") return;
  const existing = readModerationQueue();
  window.localStorage.setItem(
    MODERATION_QUEUE_STORAGE_KEY,
    JSON.stringify([item, ...existing])
  );
}
