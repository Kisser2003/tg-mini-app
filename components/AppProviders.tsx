"use client";

import { MotionConfig } from "framer-motion";
import { SWRConfig } from "swr";
import { TelegramInitDataProvider } from "@/lib/telegram-init-data-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TelegramInitDataProvider>
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          revalidateOnReconnect: true,
          dedupingInterval: 10_000
        }}
      >
        {/* «Уменьшить движение» в ОС отключает transform-анимации framer-motion везде */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </SWRConfig>
    </TelegramInitDataProvider>
  );
}
