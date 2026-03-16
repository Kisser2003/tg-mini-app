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

type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramUser;
    query_id?: string;
    auth_date?: number;
    hash?: string;
  };
  colorScheme?: "light" | "dark";
  themeParams?: Record<string, string>;
  isExpanded?: boolean;
  MainButton?: MainButton;
  expand?: () => void;
  ready?: () => void;
  setHeaderColor?: (colorKey: "bg_color" | "secondary_bg_color") => void;
  setBackgroundColor?: (color: string) => void;
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

export function initTelegramWebApp() {
  const webApp = getTelegramWebApp();
  if (!webApp) return null;

  try {
    webApp.ready?.();
    webApp.expand?.();
    webApp.setHeaderColor?.("bg_color");
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

