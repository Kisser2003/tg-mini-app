/** Лёгкая клиентская аналитика воронки мастера. Никогда не бросает и не блокирует UI. */
type FunnelEvent =
  | "wizard_step_view"
  | "submit_attempt"
  | "submit_success"
  | "submit_error"
  | "reopen_rejected";

const ANON_KEY = "omf_anon_id";

function getAnonId(): string {
  try {
    let id = window.localStorage.getItem(ANON_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "anon-session-" + Math.random().toString(36).slice(2, 12);
  }
}

export function trackFunnel(
  event: FunnelEvent,
  data: { step?: string; releaseId?: string | null; props?: Record<string, string | number | boolean> } = {}
): void {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "production") return;
  try {
    void fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: getAnonId(), event, ...data }),
      keepalive: true
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
