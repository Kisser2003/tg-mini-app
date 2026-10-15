"use client";

import type { ComponentProps } from "react";
import { AppOrb } from "@/components/AppOrb";

/**
 * Единый полноэкранный лоадер (тот же паттерн, что в `app/create/layout.tsx`).
 */
type Props = {
  label?: string;
  state?: ComponentProps<typeof AppOrb>["state"];
};

export function FullScreenLoader({ label = "Загружаем…", state = "breathing" }: Props) {
  return (
    <div className="flex min-h-[min(100dvh,720px)] flex-col items-center justify-center gap-4 px-4" role="status">
      <AppOrb state={state} />
      <p className="text-[15px] text-omf-graphite">{label}</p>
    </div>
  );
}
