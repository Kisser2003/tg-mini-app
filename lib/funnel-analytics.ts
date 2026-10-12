import { getTelegramApiAuthHeaders } from "@/lib/telegram";

/** Лёгкая клиентская аналитика воронки мастера. Никогда не бросает и не блокирует UI. */
type FunnelEvent =
  | "wizard_step_view"
  | "submit_attempt"
  | "submit_success"
  | "submit_error"
  | "reopen_rejected";

export function trackFunnel(
  event: FunnelEvent,
  data: { step?: string; releaseId?: string | null; props?: Record<string, string | number | boolean> } = {}
): void {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "production") return;
  try {
    void fetch("/api/analytics/event", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...getTelegramApiAuthHeaders() },
      body: JSON.stringify({ event, ...data }),
      keepalive: true
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
