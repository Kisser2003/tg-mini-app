"use client";

import { SWRConfig } from "swr";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 5000,
        isPaused: () => typeof document !== "undefined" && !document.hasFocus()
      }}
    >
      {children}
    </SWRConfig>
  );
}
