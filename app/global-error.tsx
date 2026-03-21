"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/global-error] global error boundary triggered", error);
  }, [error]);

  return (
    <html lang="ru">
      <body className="min-h-[100dvh] bg-[#030303] px-4 py-10 text-white">
        <div className="mx-auto w-full max-w-[440px] rounded-[20px] border border-red-500/25 bg-red-950/30 p-5">
          <p className="text-base font-semibold">Критическая ошибка приложения</p>
          <p className="mt-2 text-sm text-white/80">
            Приложение столкнулось с неожиданной ошибкой. Нажмите кнопку ниже, чтобы
            попробовать восстановиться.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-[12px] border border-red-300/40 bg-red-500/15 px-4 text-sm font-medium"
          >
            Перезапустить экран
          </button>
        </div>
      </body>
    </html>
  );
}

