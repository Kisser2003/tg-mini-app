"use client";

import { AppOrb } from "@/components/AppOrb";

export function LoadingScreen() {
  return (
    <div className="flex min-h-[65vh] items-center justify-center" role="status" aria-label="Загружаем">
      <AppOrb state="breathing" />
    </div>
  );
}
