"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { getTelegramWebApp, initTelegramWebApp } from "@/lib/telegram";

type TelegramAuthContextValue = {
  /** Raw `Telegram.WebApp.initData` string for API `fetch` headers (when present). */
  initData: string | null;
  /** True once we have read from Telegram (may still be null outside TMA). */
  ready: boolean;
};

const TelegramInitDataContext = createContext<TelegramAuthContextValue | null>(null);

/** Supplies `initData` to client trees (API routes still use `withTelegramAuth` on the server). */
export function TelegramInitDataProvider({ children }: { children: ReactNode }) {
  const [initData, setInitData] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initTelegramWebApp();
    setInitData(getTelegramWebApp()?.initData ?? null);
    setReady(true);
  }, []);

  const value = useMemo(() => ({ initData, ready }), [initData, ready]);

  return (
    <TelegramInitDataContext.Provider value={value}>{children}</TelegramInitDataContext.Provider>
  );
}

export function useTelegramInitData(): TelegramAuthContextValue {
  const ctx = useContext(TelegramInitDataContext);
  if (!ctx) {
    throw new Error("useTelegramInitData must be used within TelegramInitDataProvider");
  }
  return ctx;
}
