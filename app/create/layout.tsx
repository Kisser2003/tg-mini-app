"use client";

import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import { AppOrb } from "@/components/AppOrb";

/**
 * Гидратор persist для черновика. Слайд между шагами — в `CreateShell` +
 * `features/release/createRelease/components/CreateStepTransition` (один слой анимации).
 */
export default function CreateLayout({ children }: { children: React.ReactNode }) {
  const hasHydrated = useCreateReleaseDraftStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return (
      <div className="flex min-h-[100svh] flex-col items-center justify-center gap-4" role="status">
        <AppOrb state="working" />
        <p className="text-[15px] text-omf-graphite">Открываем черновик…</p>
      </div>
    );
  }

  return <>{children}</>;
}
