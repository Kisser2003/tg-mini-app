import { getTelegramApiAuthHeaders, initTelegramWebApp } from "@/lib/telegram";

/**
 * Клиент для маршрутов владельца релиза (`/api/releases/*`). Прямые запросы к `releases`/`tracks`
 * через anon-ключ больше не работают: RLS не доверяет заголовку `x-telegram-user-id`.
 */
export class ReleaseApiError extends Error {
  readonly status: number;
  /** `PGRST116` при 404 — совместимо с проверками «строки нет» из PostgREST. */
  readonly code: string | undefined;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ReleaseApiError";
    this.status = status;
    this.code = status === 404 ? "PGRST116" : undefined;
  }
}

type ApiBody = { ok?: boolean; error?: string } & Record<string, unknown>;

/**
 * fetch с Telegram initData / cookie-сессией. На 401 один раз переинициализирует WebApp
 * (initData мог ещё не появиться) и повторяет запрос.
 */
export async function releaseApiRequest<T extends ApiBody>(
  path: string,
  init?: { method?: "GET" | "POST" | "DELETE"; body?: unknown; keepalive?: boolean }
): Promise<T> {
  const doFetch = () =>
    fetch(path, {
      method: init?.method ?? "GET",
      credentials: "include",
      cache: "no-store",
      keepalive: init?.keepalive,
      headers: {
        Accept: "application/json",
        ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(typeof window !== "undefined" ? getTelegramApiAuthHeaders() : {})
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined
    });

  let res = await doFetch();
  if (res.status === 401 && typeof window !== "undefined") {
    initTelegramWebApp();
    res = await doFetch();
  }

  let json: T | null = null;
  try {
    json = (await res.json()) as T;
  } catch {
    json = null;
  }

  if (!res.ok || !json || json.ok !== true) {
    const message =
      typeof json?.error === "string" && json.error.length > 0
        ? json.error
        : `Запрос ${path} завершился с ошибкой (HTTP ${res.status}).`;
    throw new ReleaseApiError(message, res.status);
  }

  return json;
}
