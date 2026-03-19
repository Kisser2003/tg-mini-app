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
    <div className="mx-auto flex min-h-[60vh] w-full max-w-[440px] items-center px-4 py-8">
      <div className="w-full rounded-[20px] border border-red-500/25 bg-red-950/30 p-5 text-red-100">
        <p className="text-sm font-semibold">Ошибка на экране</p>
        <p className="mt-2 text-xs text-red-100/85">
          Что-то пошло не так при загрузке данных. Попробуйте перезагрузить экран.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-[12px] border border-red-300/40 bg-red-500/15 px-4 text-sm font-medium"
        >
          Повторить
        </button>
      </div>
    </div>
  );
}

