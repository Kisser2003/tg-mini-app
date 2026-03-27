"use client";

import { SWRConfig } from "swr";
import { TelegramInitDataProvider } from "@/lib/telegram-init-data-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TelegramInitDataProvider>
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          revalidateOnReconnect: true,
          dedupingInterval: 10_000,
          isPaused: () => typeof document !== "undefined" && !document.hasFocus()
        }}
      >
        {children}
      </SWRConfig>
    </TelegramInitDataProvider>
  );
}
