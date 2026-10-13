/**
 * «Новое» в списке релизов: решение модератора (Принят/Отклонён), которое артист ещё не открывал.
 * Хранится локально по релизу; для веб-аккаунтов без Telegram это основной сигнал о смене статуса.
 */
const PREFIX = "omf_seen_status:";

function read(id: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + id);
  } catch {
    return null;
  }
}

export function readSeenStatuses(ids: string[]): Record<string, string | null> {
  if (typeof window === "undefined") return {};
  const out: Record<string, string | null> = {};
  for (const id of ids) out[id] = read(id);
  return out;
}

export function markStatusSeen(id: string, status: string): void {
  try {
    window.localStorage.setItem(PREFIX + id, status);
  } catch {
    /* ignore */
  }
}

/** Новым считаем только финальные статусы, которых ещё не видели. */
export function isUnseenDecision(status: string, seen: string | null | undefined): boolean {
  return (status === "ready" || status === "failed") && seen !== status;
}
