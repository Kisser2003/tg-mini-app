"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

/**
 * Локальные E2E и дев-режим: `?devUserId=` + `NEXT_PUBLIC_ALLOW_DEV_API_AUTH=true`
 * обходят cookie-auth (см. `middleware` + `AuthGuard`), без реального Telegram initData.
 * Значение дублируется в sessionStorage, чтобы SPA-переходы без query всё ещё проходили guard.
 */
export function useDevE2eAuthBypass(): boolean {
  const pathname = usePathname();

  return useMemo(() => {
    void pathname;
    if (process.env.NEXT_PUBLIC_ALLOW_DEV_API_AUTH !== "true") return false;
    if (typeof window === "undefined") return false;

    const params = new URLSearchParams(window.location.search);
    let raw = params.get("devUserId");
    if (raw != null) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) {
        try {
          sessionStorage.setItem("e2eDevUserId", raw);
        } catch {
          /* private mode */
        }
        return true;
      }
    }
    try {
      raw = sessionStorage.getItem("e2eDevUserId");
    } catch {
      raw = null;
    }
    if (raw == null) return false;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0;
  }, [pathname]);
}
