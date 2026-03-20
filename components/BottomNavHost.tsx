"use client";

import { ErrorBoundary } from "react-error-boundary";
import { BottomNav } from "@/components/BottomNav";
import { logClientError } from "@/lib/logger";

/**
 * Навбар вне AppErrorBoundary в layout — без своей границы любой throw там
 * валит весь клиентский рендер (белый экран). Здесь изолируем сбой.
 */
function BottomNavFallback() {
  return null;
}

export function BottomNavHost() {
  return (
    <ErrorBoundary
      FallbackComponent={BottomNavFallback}
      onError={(error, info) => {
        const route = typeof window !== "undefined" ? window.location.pathname : "";
        logClientError({
          error,
          screenName: "BottomNavHost",
          route,
          componentStack: info.componentStack ?? null,
          extra: { source: "bottom-nav-error-boundary" }
        });
      }}
    >
      <BottomNav />
    </ErrorBoundary>
  );
}
