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
      <body
        style={{ minHeight: "100dvh", background: "#1a1d24", color: "#eceef0", margin: 0, padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}
      >
        <div style={{ maxWidth: 440, margin: "0 auto" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, lineHeight: 0.95, margin: 0 }}>Приложение остановилось</h1>
          <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.5, color: "#8c93a1" }}>
            Произошла неожиданная ошибка. Перезапусти экран. Если повторится, напиши в поддержку.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ marginTop: 24, width: "100%", height: 56, border: 0, borderRadius: 14, background: "#2f3fe0", color: "#fff", fontSize: 16, fontWeight: 700 }}
          >
            Перезапустить
          </button>
        </div>
      </body>
    </html>
  );
}
