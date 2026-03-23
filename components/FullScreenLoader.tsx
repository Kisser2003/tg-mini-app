"use client";

/**
 * Единый полноэкранный лоадер (тот же паттерн, что в `app/create/layout.tsx`).
 */
export function FullScreenLoader({ label = "Загрузка…" }: { label?: string }) {
  return (
    <div className="flex min-h-[min(100dvh,720px)] flex-col items-center justify-center gap-4 px-4">
      <div className="rounded-[24px] border border-white/[0.08] bg-surface/80 p-8 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-[#7C3AED]"
            aria-hidden="true"
          />
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}
