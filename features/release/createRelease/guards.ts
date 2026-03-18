"use client";

import { useMemo } from "react";
import type { CreateStep } from "./types";
import {
  useCreateReleaseDraftStore,
  selectIsMetadataComplete,
  selectIsAssetsComplete,
  selectIsTracksComplete
} from "./store";

export type GuardResult =
  | { allowed: true }
  | {
      allowed: false;
      title: string;
      description: string;
      redirectTo: CreateStep;
      actionLabel: string;
    };

export function useStepGuard(step: CreateStep): GuardResult {
  const hasHydrated = useCreateReleaseDraftStore((s) => s.hasHydrated);
  const releaseId = useCreateReleaseDraftStore((s) => s.releaseId);
  const releaseType = useCreateReleaseDraftStore((s) => s.metadata.releaseType);
  const isMetadataComplete = useCreateReleaseDraftStore(selectIsMetadataComplete);
  const isAssetsComplete = useCreateReleaseDraftStore(selectIsAssetsComplete);
  // selectIsTracksComplete already forwards releaseType internally via store selector
  const isTracksComplete = useCreateReleaseDraftStore(selectIsTracksComplete);

  return useMemo(() => {
    if (!hasHydrated) {
      return {
        allowed: false,
        title: "Загрузка…",
        description: "Подготавливаем черновик релиза.",
        redirectTo: "metadata",
        actionLabel: "Ок"
      };
    }
    if (step === "metadata") return { allowed: true };

    if (!isMetadataComplete) {
      return {
        allowed: false,
        title: "Сначала заполните паспорт релиза",
        description:
          "Чтобы перейти дальше, нужно заполнить базовые данные релиза на шаге «Паспорт».",
        redirectTo: "metadata",
        actionLabel: "Перейти к паспорту"
      };
    }

    if (step === "assets") return { allowed: true };

    if (!releaseId && (step === "tracks" || step === "review" || step === "success")) {
      return {
        allowed: false,
        title: "Черновик релиза ещё не создан",
        description: "Загрузите обложку на шаге «Обложка», затем продолжайте.",
        redirectTo: "assets",
        actionLabel: "Перейти к обложке"
      };
    }

    if (!isAssetsComplete) {
      return {
        allowed: false,
        title: "Сначала загрузите обложку",
        description:
          "Перед добавлением треков нужно загрузить обложку (JPG/PNG) на шаге «Обложка».",
        redirectTo: "assets",
        actionLabel: "Перейти к обложке"
      };
    }

    if (step === "tracks") return { allowed: true };

    if (!isTracksComplete) {
      const tracksHint =
        releaseType === "single"
          ? "Сингл должен содержать ровно 1 трек с заполненным названием."
          : "EP/Альбом должен содержать минимум 2 трека с заполненными названиями.";
      return {
        allowed: false,
        title: "Сначала добавьте треки",
        description: tracksHint,
        redirectTo: "tracks",
        actionLabel: "Перейти к трекам"
      };
    }

    if (step === "review") return { allowed: true };

    // success is reachable only after explicit submit, but we allow if successSummary exists
    return { allowed: true };
  }, [hasHydrated, isAssetsComplete, isMetadataComplete, isTracksComplete, releaseId, releaseType, step]);
}
