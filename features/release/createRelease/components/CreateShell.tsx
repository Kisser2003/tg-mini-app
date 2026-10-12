"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  CREATE_FLOW_STEPS,
  getCreateBackPath,
  getCreateStepIndexFromPath
} from "@/lib/create-steps";
import { CreateStepTransition } from "@/features/release/createRelease/components/CreateStepTransition";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import { ReleaseSleeve } from "@/components/ReleaseSleeve";
import { useHaptics } from "@/lib/hooks/useHaptics";
import { useIsTelegramMiniApp } from "@/lib/hooks/useIsTelegramMiniApp";
import { useTelegramBackButton } from "@/lib/hooks/useTelegramBackButton";
import { getTelegramWebApp } from "@/lib/telegram";
import { cn } from "@/lib/utils";

export function CreateShell({
  children,
  title
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const haptics = useHaptics();
  const isTelegram = useIsTelegramMiniApp();

  const activeIndex = useMemo(() => getCreateStepIndexFromPath(pathname), [pathname]);
  const releaseTitle = useCreateReleaseDraftStore((st) => st.metadata.releaseTitle);
  const primaryArtist = useCreateReleaseDraftStore((st) => st.metadata.primaryArtist);
  const artworkUrl = useCreateReleaseDraftStore((st) => st.artworkUrl);
  const releaseId = useCreateReleaseDraftStore((st) => st.releaseId);

  /** Нативная MainButton Telegram скрыта — в мастере используются только кнопки в интерфейсе. */
  useEffect(() => {
    const btn = getTelegramWebApp()?.MainButton;
    if (!btn) return;
    try {
      btn.hide();
      btn.hideProgress?.();
    } catch {
      /* ignore */
    }
    return () => {
      try {
        btn.hide();
        btn.hideProgress?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  useTelegramBackButton(
    () => {
      haptics.impactLight();
      router.push(getCreateBackPath(pathname));
    },
    activeIndex > 0
  );

  const goBack = () => {
    haptics.impactLight();
    router.push(getCreateBackPath(pathname));
  };

  const stepCount = CREATE_FLOW_STEPS.length - 1;
  const isSuccess = activeIndex >= stepCount;
  const stepLabel = CREATE_FLOW_STEPS[activeIndex]?.label ?? "";

  return (
    <div
      className={cn(
        "min-h-[100dvh] text-omf-ink",
        isTelegram ? "px-1 pb-10 pt-4" : "w-full px-1 pb-16 pt-6 md:pb-20 md:pt-8"
      )}
    >
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        {!isSuccess ? (
          <header>
            <button
              type="button"
              onClick={goBack}
              className="omf-focus -ml-2 mb-4 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[14px] text-omf-graphite transition-colors hover:text-omf-ink"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {activeIndex === 0 ? "Релизы" : CREATE_FLOW_STEPS[activeIndex - 1]?.label}
            </button>

            <div className="flex items-center gap-4">
              <div className="w-[72px] shrink-0">
                <ReleaseSleeve
                  seed={releaseId ?? "new-release"}
                  title={releaseTitle.trim() || "Без названия"}
                  artist={primaryArtist.trim() || null}
                  coverUrl={artworkUrl}
                  size="thumb"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[22px] font-extrabold leading-tight tracking-[-0.03em]">
                  {releaseTitle.trim() || "Новый релиз"}
                </p>
                <p className="mt-1 truncate text-[14px] text-omf-graphite">
                  {primaryArtist.trim() || "Артист не указан"}
                </p>
                <p className="mt-0.5 text-[13px] text-omf-faint">
                  Шаг {activeIndex + 1} из {stepCount}: {stepLabel.toLowerCase()}
                </p>
              </div>
            </div>

            <div
              className="mt-5 flex gap-1"
              role="progressbar"
              aria-label="Шаги создания релиза"
              aria-valuemin={1}
              aria-valuemax={stepCount}
              aria-valuenow={activeIndex + 1}
            >
              {CREATE_FLOW_STEPS.slice(0, stepCount).map((s, i) => (
                <span
                  key={s.key}
                  className={cn(
                    "h-[3px] flex-1 rounded-full transition-colors duration-300",
                    i <= activeIndex ? "bg-omf-ultra" : "bg-omf-line"
                  )}
                />
              ))}
            </div>
          </header>
        ) : null}

        <CreateStepTransition>
          <div className="flex flex-col gap-5">
            {title ? (
              <h2 className="text-[20px] font-bold tracking-[-0.02em] text-omf-ink">{title}</h2>
            ) : null}
            {children}
          </div>
        </CreateStepTransition>
      </div>
    </div>
  );
}
