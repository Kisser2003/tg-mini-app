"use client";

/**
 * Единый полноэкранный лоадер (тот же паттерн, что в `app/create/layout.tsx`).
 */
export function FullScreenLoader({ label = "Загружаем…" }: { label?: string }) {
  return (
    <div className="omf-delayed-in flex min-h-[min(100dvh,720px)] flex-col items-center justify-center gap-4 px-4" role="status">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-omf-line border-t-omf-ultra"
        aria-hidden="true"
      />
      <p className="text-[15px] text-omf-graphite">{label}</p>
    </div>
  );
}
