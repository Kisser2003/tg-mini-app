"use client";

import {
  ErrorBoundary as ReactErrorBoundary,
  type FallbackProps
} from "react-error-boundary";
import { logClientError } from "@/lib/logger";

function ErrorFallback({ error: _error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-[28px] font-extrabold leading-[0.95] tracking-[-0.03em] text-omf-ink">
        Что-то сломалось
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-omf-graphite">
        Мы уже получили отчёт об ошибке. Обнови экран. Если не помогло, напиши в поддержку.
      </p>
      <button type="button" onClick={resetErrorBoundary} className="omf-btn-primary mt-6 h-14 w-full text-[16px]">
        Обновить экран
      </button>
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
          screenName: "AppErrorBoundary",
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
