/** Понятное сообщение при сетевом таймауте (без технических деталей). */
export const USER_REQUEST_TIMEOUT_MESSAGE =
  "Сервер не ответил вовремя. Проверьте интернет и попробуйте ещё раз.";

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

