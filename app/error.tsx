"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error] route error boundary triggered", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center px-5 py-8">
      <h1 className="text-[28px] font-extrabold leading-[0.95] tracking-[-0.03em] text-omf-ink">
        Экран не загрузился
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-omf-graphite">
        Не получилось получить данные. Проверь интернет и попробуй ещё раз.
      </p>
      <button type="button" onClick={() => reset()} className="omf-btn-primary mt-6 h-14 w-full text-[16px]">
        Попробовать ещё раз
      </button>
    </div>
  );
}
