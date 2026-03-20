"use client";

import { SWRConfig } from "swr";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        dedupingInterval: 5000
      }}
    >
      {children}
    </SWRConfig>
  );
}
