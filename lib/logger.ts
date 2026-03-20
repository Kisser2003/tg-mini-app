import { formatErrorMessage } from "@/lib/errors";
import { getTelegramUserId } from "@/lib/telegram";

export type ClientLogPayload = {
  error: unknown;
  /** Путь страницы, например /library */
  route?: string;
  componentStack?: string | null;
  extra?: Record<string, unknown>;
};

function getStack(error: unknown): string {
  if (error instanceof Error && error.stack) return error.stack;
  return "";
}

/**
 * Глобальное логирование с клиента: в dev — console.error, в prod — POST /api/client-error (Supabase error_logs при наличии service role).
 */
export function logClientError(payload: ClientLogPayload): void {
  const errorMessage = formatErrorMessage(payload.error, "Unknown error");
  const stackTrace = getStack(payload.error);
  const userId = typeof window !== "undefined" ? getTelegramUserId() : null;

  const body = {
    userId,
    route: payload.route ?? (typeof window !== "undefined" ? window.location.pathname : null),
    errorMessage,
    stackTrace: stackTrace || null,
    componentStack: payload.componentStack ?? null,
    extra: payload.extra ?? null
  };

  if (process.env.NODE_ENV === "development") {
    console.error("[logClientError]", body, payload.error);
    return;
  }

  try {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true
    }).catch(() => {});
  } catch {
    // ignore
  }
}

/** Детали ошибки загрузки в Storage (XHR). */
export function getUploadErrorDetails(error: unknown): {
  httpStatus: number | null;
  supabaseHint: string | null;
} {
  if (error && typeof error === "object" && "statusCode" in error) {
    const sc = (error as { statusCode?: unknown }).statusCode;
    const httpStatus = typeof sc === "number" ? sc : null;
    const bodySnippet =
      "responseBody" in error && typeof (error as { responseBody?: unknown }).responseBody === "string"
        ? String((error as { responseBody: string }).responseBody).slice(0, 500)
        : null;
    let supabaseHint: string | null = null;
    if (bodySnippet) {
      try {
        const j = JSON.parse(bodySnippet) as { error?: string; message?: string; statusCode?: string };
        supabaseHint = j.message || j.error || j.statusCode || null;
      } catch {
        supabaseHint = bodySnippet.slice(0, 200);
      }
    }
    return { httpStatus, supabaseHint };
  }
  return { httpStatus: null, supabaseHint: null };
}
