/** Понятное сообщение при сетевом таймауте (без технических деталей). */
export const USER_REQUEST_TIMEOUT_MESSAGE =
  "Сервер не ответил вовремя. Проверьте интернет и попробуйте ещё раз.";

/**
 * Для отладки: Supabase/PostgREST часто отдаёт plain object — `String(err)` даёт `[object Object]`.
 * Сериализует собственные поля объекта (в т.ч. message, code, details, hint).
 */
export function stringifyErrorForDebug(err: unknown): string | null {
  if (err == null) return null;
  if (typeof err === "object" && err !== null) {
    try {
      return JSON.stringify(err, Object.getOwnPropertyNames(err));
    } catch {
      return String(err);
    }
  }
  return String(err);
}

/** Сообщение для UI из Error, PostgREST или plain object (Supabase часто кидает не Error). */
export function formatErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.trim().length > 0) return err;
  if (typeof err === "object" && err !== null) {
    const o = err as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof o.message === "string" && o.message.trim().length > 0) parts.push(o.message.trim());
    if (typeof o.details === "string" && o.details.trim().length > 0) parts.push(o.details.trim());
    if (typeof o.hint === "string" && o.hint.trim().length > 0) parts.push(o.hint.trim());
    if (parts.length > 0) return parts.join(" — ");
  }
  return fallback;
}

/** PostgREST: колонка ещё не в схеме / не применена миграция. */
export function isMissingReleasesColumnError(err: unknown, column: string): boolean {
  const m = formatErrorMessage(err, "").toLowerCase();
  const c = column.toLowerCase();
  return m.includes(c) && (m.includes("schema cache") || m.includes("could not find"));
}

/**
 * Убирает из payload поля, по которым пришла ошибка «column … does not exist».
 * Возвращает null, если колонку определить нельзя — тогда повторять бессмысленно.
 */
export function tryOmitMissingReleasesColumns(
  err: unknown,
  payload: Record<string, unknown>
): Record<string, unknown> | null {
  if (isMissingReleasesColumnError(err, "artist_links") || isMissingReleasesColumnError(err, "has_existing_profiles")) {
    const { artist_links: _a, has_existing_profiles: _h, ...rest } = payload;
    return rest;
  }
  if (
    isMissingReleasesColumnError(err, "performance_language") ||
    isMissingReleasesColumnError(err, "collaborators")
  ) {
    const { performance_language: _p, collaborators: _c, ...rest } = payload;
    return rest;
  }
  return null;
}

/** Поля PostgREST/Supabase для логов и отладки (Network /rest/v1/...). */
export function getPostgrestErrorPayload(err: unknown): {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
} {
  const message = formatErrorMessage(err, "unknown_error");
  const o = err && typeof err === "object" ? (err as Record<string, unknown>) : null;
  return {
    message,
    ...(typeof o?.code === "string" ? { code: o.code } : {}),
    ...(typeof o?.details === "string" ? { details: o.details } : {}),
    ...(typeof o?.hint === "string" ? { hint: o.hint } : {})
  };
}

/** PostgREST / Postgres: отказ по RLS (INSERT/UPDATE policy). */
export function isPostgrestRlsViolation(err: unknown): boolean {
  const msg = formatErrorMessage(err, "").toLowerCase();
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  return (
    msg.includes("row-level security") ||
    (msg.includes("policy") && msg.includes("violation")) ||
    msg.includes("permission denied for") ||
    code === "42501"
  );
}

/** Явный лог при отказе RLS на INSERT в `tracks` (отладка политик Supabase). */
export function logSupabaseTracksInsertRlsDenied(context: string, err: unknown): void {
  if (!isPostgrestRlsViolation(err)) return;
  console.error("Ошибка прав доступа в Supabase (INSERT policy)", {
    context,
    ...getPostgrestErrorPayload(err)
  });
}

/** Лог в терминал (API routes / server actions): полный объект PostgREST. */
export function logSupabaseUpdateError(context: string, err: unknown): void {
  const msg = formatErrorMessage(err, "");
  const o = err && typeof err === "object" ? (err as Record<string, unknown>) : null;
  const code = o && typeof o.code === "string" ? o.code : undefined;
  const details = o && typeof o.details === "string" ? o.details : undefined;
  const hint = o && typeof o.hint === "string" ? o.hint : undefined;
  console.error(`[${context}]`, msg, { code, details, hint, raw: err });
}

/** Для SWR / Supabase: никогда не отдаёт [object Object] в UI. */
export function errorToUserString(err: unknown, fallback = "Ошибка загрузки"): string | null {
  if (err == null) return null;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.trim().length > 0) return err;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m.trim().length > 0) return m;
  }
  if (typeof err === "object" && err !== null && "error" in err) {
    const e = (err as { error: unknown }).error;
    if (typeof e === "string" && e.trim().length > 0) return e;
  }
  return fallback;
}

