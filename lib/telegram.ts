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

export function getTelegramUser(): TelegramUser | null {
  const webApp = getTelegramWebApp();
  if (!webApp) return null;
  return webApp.initDataUnsafe?.user ?? null;
}

export function getTelegramUserId(): number | null {
  const user = getTelegramUser();
  return user?.id ?? null;
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

