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
      <div className="flex min-h-[100svh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-[24px] border border-white/[0.08] bg-surface/80 p-8 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
            <div className="flex flex-col items-center gap-3">
              <div
                className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-[#7C3AED]"
                aria-hidden="true"
              />
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
                Загрузка…
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
