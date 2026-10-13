"use client";

import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";

/**
 * Гидратор persist для черновика. Слайд между шагами — в `CreateShell` +
 * `features/release/createRelease/components/CreateStepTransition` (один слой анимации).
 */
export default function CreateLayout({ children }: { children: React.ReactNode }) {
  const hasHydrated = useCreateReleaseDraftStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return (
      <div className="omf-delayed-in flex min-h-[100svh] flex-col items-center justify-center gap-4" role="status">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-omf-line border-t-omf-ultra" aria-hidden="true" />
        <p className="text-[15px] text-omf-graphite">Открываем черновик…</p>
      </div>
    );
  }

  return <>{children}</>;
}
