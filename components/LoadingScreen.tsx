"use client";

export function LoadingScreen() {
  return (
    <div className="flex min-h-[65vh] items-center justify-center" role="status" aria-label="Загружаем">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-omf-line border-t-omf-ultra" />
    </div>
  );
}
