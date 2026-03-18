"use client";

import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";

// Holds all /create/* pages behind a single hydration gate.
// On a hard page refresh the Zustand persist middleware needs one async tick
// to read localStorage and populate the store.  Until that tick completes,
// hasHydrated is false and we show a full-page glassmorphism loader so child
// pages never render with stale / empty default values.
//
// During client-side navigation (e.g. Dashboard → /create/metadata) the store
// is already hydrated, so hasHydrated is true immediately and children render
// without any loading flash.
export default function CreateLayout({ children }: { children: React.ReactNode }) {
  const hasHydrated = useCreateReleaseDraftStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          {/* Glassmorphism card spinner */}
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
