"use client";

import { useMemo } from "react";
import { hapticMap } from "@/lib/haptic-map";

/** Стабильные колбэки для тактильной отдачи TMA (в браузере — no-op). */
export function useHaptics() {
  return useMemo(
    () => ({
      selection: () => hapticMap.selection(),
      impactLight: () => hapticMap.impactLight(),
      impactMedium: () => hapticMap.impactMedium(),
      impactHeavy: () => hapticMap.impactHeavy(),
      notificationSuccess: () => hapticMap.notificationSuccess(),
      notificationError: () => hapticMap.notificationError(),
      notificationWarning: () => hapticMap.notificationWarning()
    }),
    []
  );
}
