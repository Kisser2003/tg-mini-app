"use client";

import {
  ErrorBoundary as ReactErrorBoundary,
  type FallbackProps
} from "react-error-boundary";
import { logClientError } from "@/lib/logger";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const err = error instanceof Error ? error : new Error(String(error));
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[360px] rounded-[24px] border border-white/[0.12] bg-surface/85 px-6 py-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.75)] backdrop-blur-2xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">Ошибка</p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-white">
          Упс! Что-то пошло не так
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-white/55">
          Попробуй обновить экран. Если повторится — напиши нам, мы разберёмся.
        </p>
        {process.env.NODE_ENV === "development" && (
          <pre className="mt-4 max-h-28 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-left text-[10px] text-rose-200/90">
            {err.message}
          </pre>
        )}
        <button
          type="button"
          onClick={resetErrorBoundary}
          className="mt-6 inline-flex h-[52px] w-full items-center justify-center rounded-[18px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[15px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.5)]"
        >
          Попробовать снова
        </button>
      </div>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => {
        const route = typeof window !== "undefined" ? window.location.pathname : "";
        logClientError({
          error,
          route,
          componentStack: info.componentStack ?? null,
          extra: { source: "react-error-boundary" }
        });
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
