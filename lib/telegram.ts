export type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type MainButton = {
  text: string;
  isVisible: boolean;
  isActive: boolean;
  setText: (text: string) => MainButton;
  show: () => MainButton;
  hide: () => MainButton;
  enable: () => MainButton;
  disable: () => MainButton;
  showProgress: (leaveActive?: boolean) => MainButton;
  hideProgress: () => MainButton;
  onClick: (handler: () => void) => void;
  offClick: (handler: () => void) => void;
};

type BackButton = {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (handler: () => void) => void;
  offClick: (handler: () => void) => void;
};

type HapticFeedback = {
  impactOccurred?: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  notificationOccurred?: (type: "error" | "success" | "warning") => void;
  selectionChanged?: () => void;
};

type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramUser;
    query_id?: string;
    auth_date?: number;
    start_param?: string;
    hash?: string;
  };
  colorScheme?: "light" | "dark";
  themeParams?: Record<string, string>;
  isExpanded?: boolean;
  MainButton?: MainButton;
  BackButton?: BackButton;
  HapticFeedback?: HapticFeedback;
  expand?: () => void;
  ready?: () => void;
  setHeaderColor?: (colorKey: "bg_color" | "secondary_bg_color") => void;
  setBackgroundColor?: (color: string) => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

export function isTelegramMiniApp(): boolean {
  return Boolean(getTelegramWebApp()?.initData);
}

/** Счётчик причин держать enableClosingConfirmation (bootstrap + загрузки). */
let closingConfirmationRefCount = 0;

function applyTelegramClosingConfirmationFromRefCount(): void {
  const webApp = getTelegramWebApp();
  if (!webApp) return;
  try {
    if (closingConfirmationRefCount > 0) {
      webApp.enableClosingConfirmation?.();
    } else {
      webApp.disableClosingConfirmation?.();
    }
  } catch {
    /* ignore */
  }
}

/**
 * Запросить подтверждение при закрытии (увеличить счётчик).
 * Пока счётчик > 0, WebApp спросит перед выходом.
 */
export function acquireTelegramClosingConfirmation(): void {
  closingConfirmationRefCount += 1;
  applyTelegramClosingConfirmationFromRefCount();
}

/**
 * Снять один запрос подтверждения (уменьшить счётчик).
 */
export function releaseTelegramClosingConfirmation(): void {
  closingConfirmationRefCount = Math.max(0, closingConfirmationRefCount - 1);
  applyTelegramClosingConfirmationFromRefCount();
}

/**
 * @deprecated Используйте пару acquire/release — иначе ломается общий счётчик с bootstrap.
 */
export function setTelegramClosingConfirmation(enabled: boolean): void {
  if (enabled) acquireTelegramClosingConfirmation();
  else releaseTelegramClosingConfirmation();
}

export function initTelegramWebApp() {
  const webApp = getTelegramWebApp();
  if (!webApp) return null;

  try {
    webApp.ready?.();
    /** Развернуть WebApp на весь экран (меньше «дёрганий» от системной шапки Telegram). */
    webApp.expand?.();
    webApp.setHeaderColor?.("bg_color");
    if (webApp.initData) {
      const encoded = encodeURIComponent(webApp.initData);
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `tg_init_data=${encoded}; Path=/; Max-Age=86400; SameSite=Lax${secure}`;
    }
  } catch {
    // ignore API errors in regular browser
  }

  return webApp;
}

/**
 * Сырой initData для API с подписью Telegram (заголовок `X-Telegram-Init-Data` или cookie `tg_init_data`).
 * Перед чтением вызывает `initTelegramWebApp()`, чтобы обновить cookie.
 */
export function getTelegramInitDataForApiHeader(): string {
  if (typeof window === "undefined") return "";
  initTelegramWebApp();
  return getTelegramWebApp()?.initData?.trim() ?? "";
}

/** Синхронизация с `userId` в сторе мастера создания релиза (для RLS в PostgREST/Storage). */
let rlsTelegramUserIdOverride: number | null = null;

export function setRlsTelegramUserIdOverride(userId: number | null): void {
  rlsTelegramUserIdOverride = userId;
}

function devUserIdFromQuery(): number | null {
  if (process.env.NODE_ENV === "production") return null;
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("devUserId");
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return Math.trunc(n);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function devUserIdWhenNoTelegramWebApp(): number | null {
  if (process.env.NODE_ENV === "production") return null;
  if (typeof window === "undefined") return null;
  const hasTelegram = Boolean(getTelegramWebApp()?.initDataUnsafe?.user?.id);
  if (hasTelegram) return null;
  return 1;
}

/**
 * Тот же расчёт, что в `initUserContextInStore` (create release): заголовок `x-telegram-user-id`
 * для Supabase должен совпадать с `user_id` в `releases` / `tracks`, иначе RLS даёт отказ.
 * Раньше в dev без Telegram подставлялся ID админа — строки с `user_id: 1` не проходили.
 */
export function getTelegramUserIdForSupabaseRequests(): number | null {
  if (rlsTelegramUserIdOverride != null) return rlsTelegramUserIdOverride;
  const devUserId = devUserIdFromQuery() ?? devUserIdWhenNoTelegramWebApp();
  return devUserId ?? getTelegramUserId() ?? null;
}

/** Заголовок для dev-only обхода без initData (см. `withTelegramAuth` + `ALLOW_DEV_API_AUTH`). */
export const TELEGRAM_DEV_USER_ID_HEADER = "X-Dev-Telegram-User-Id";

/**
 * Тот же `userId`, что в `getDevUserIdOverride` / `getDevUserIdDefault` в create-release actions:
 * localhost без Telegram WebApp — подставляется число, чтобы совпадать с черновиком в БД.
 */
function getDevUserIdForApiHeaders(): number | null {
  if (process.env.NODE_ENV === "production") return null;
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("devUserId");
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return Math.trunc(n);
    }
  } catch {
    /* ignore */
  }
  const hasTelegram = Boolean(getTelegramWebApp()?.initDataUnsafe?.user?.id);
  if (hasTelegram) return null;
  return 1;
}

/**
 * Заголовки для `fetch` к API с `withTelegramAuth`.
 * - Сначала подписанный `X-Telegram-Init-Data` (если есть).
 * - В `next dev` без initData всегда шлём `X-Dev-Telegram-User-Id` (совпадает с `user_id` / Storage),
 *   чтобы сборка чанков WAV (`stitch-track-parts`) и прочие API не отдавали 401 в обычном браузере.
 * - Опционально `NEXT_PUBLIC_ALLOW_DEV_API_AUTH=false` отключает этот заголовок (строгий локальный режим).
 * - При несовпадении токена бота в dev сервер может принять запрос, если id из initData совпадает с заголовком.
 */
export function getTelegramApiAuthHeaders(options?: { userId?: number | null }): Record<string, string> {
  initTelegramWebApp();
  const initData = getTelegramWebApp()?.initData?.trim() ?? "";
  const headers: Record<string, string> = {};
  if (initData.length > 0) {
    headers["X-Telegram-Init-Data"] = initData;
  }

  const devUid =
    options?.userId != null && options.userId > 0
      ? options.userId
      : getTelegramUserId() ?? getDevUserIdForApiHeaders();

  const strictDev =
    typeof process.env.NEXT_PUBLIC_ALLOW_DEV_API_AUTH === "string" &&
    process.env.NEXT_PUBLIC_ALLOW_DEV_API_AUTH === "false";

  const allowDevHeader =
    process.env.NODE_ENV === "development" && !strictDev && initData.length === 0;

  if (allowDevHeader && devUid != null && devUid > 0) {
    headers[TELEGRAM_DEV_USER_ID_HEADER] = String(devUid);
  }

  return headers;
}

/**
 * Достаёт пользователя из подписанной строки `initData`, если `initDataUnsafe.user`
 * ещё не заполнен (встречается в Mini App на части клиентов Telegram).
 */
function parseTelegramUserFromInitDataString(initDataRaw: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initDataRaw.trim());
    const userRaw = params.get("user");
    if (!userRaw) return null;
    const parsed = JSON.parse(userRaw) as {
      id?: unknown;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    if (typeof parsed?.id !== "number" || !Number.isFinite(parsed.id)) return null;
    return {
      id: Math.trunc(parsed.id),
      username: parsed.username,
      first_name: parsed.first_name,
      last_name: parsed.last_name
    };
  } catch {
    return null;
  }
}

export function getTelegramUser(): TelegramUser | null {
  const webApp = getTelegramWebApp();
  if (!webApp) return null;
  const unsafe = webApp.initDataUnsafe?.user;
  if (unsafe) return unsafe;
  const raw = webApp.initData?.trim();
  if (!raw) return null;
  return parseTelegramUserFromInitDataString(raw);
}

export function getTelegramUserId(): number | null {
  const user = getTelegramUser();
  return user?.id ?? null;
}

/** Логин без ведущего @; из `initDataUnsafe.user.username`. */
export function getTelegramUsername(): string | null {
  const user = getTelegramUser();
  const raw = user?.username?.trim();
  if (!raw) return null;
  return raw.replace(/^@+/, "");
}

export function getTelegramUserDisplayName(): string | null {
  const user = getTelegramUser();
  if (!user) return null;

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  if (fullName) return fullName;

  try {
    if (user.username) return `@${user.username}`;
  } catch {
    // ignore
  }

  return null;
}

export function getTelegramStartParam(): string | null {
  const webApp = getTelegramWebApp();
  if (!webApp) return null;
  const raw = webApp.initDataUnsafe?.start_param;
  return raw && raw.trim().length > 0 ? raw : null;
}

/**
 * Тактильная отдача в Telegram Mini App (безопасный no-op в обычном браузере).
 */
export function triggerHaptic(
  type: "light" | "medium" | "success" | "warning" | "error" = "light"
): void {
  const h = getTelegramWebApp()?.HapticFeedback;
  if (!h) return;
  try {
    if (type === "success") {
      h.notificationOccurred?.("success");
      return;
    }
    if (type === "warning") {
      h.notificationOccurred?.("warning");
      return;
    }
    if (type === "error") {
      h.notificationOccurred?.("error");
      return;
    }
    if (type === "light") {
      h.impactOccurred?.("light");
      return;
    }
    h.impactOccurred?.("medium");
  } catch {
    // ignore
  }
}

