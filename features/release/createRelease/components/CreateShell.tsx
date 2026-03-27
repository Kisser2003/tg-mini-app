"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  CREATE_FLOW_STEPS,
  getCreateBackPath,
  getCreateStepIndexFromPath
} from "@/lib/create-steps";
import { CreateStepTransition } from "@/features/release/createRelease/components/CreateStepTransition";
import { hapticMap } from "@/lib/haptic-map";
import { SPRING_PROGRESS } from "@/lib/motion-spring";
import { useTelegramBackButton } from "@/lib/hooks/useTelegramBackButton";

export function CreateShell({
  children,
  title
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const activeIndex = useMemo(() => getCreateStepIndexFromPath(pathname), [pathname]);
  const progress = useMemo(() => {
    const denom = Math.max(1, CREATE_FLOW_STEPS.length - 1);
    return (activeIndex / denom) * 100;
  }, [activeIndex]);

  // Show Telegram native BackButton on all steps except the first.
  // Falls back gracefully when running outside the Telegram Mini App.
  useTelegramBackButton(
    () => {
      hapticMap.impactLight();
      router.push(getCreateBackPath(pathname));
    },
    activeIndex > 0
  );

  return (
    <div className="bg-background px-5 py-6 pb-10 text-text">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-5 font-sans">

        {/* Static shell header — does not re-animate on step changes */}
        <header className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            {/* Fallback back button for non-Telegram environments (browser dev/testing) */}
            <button
              type="button"
              onClick={() => {
                hapticMap.impactLight();
                router.push(getCreateBackPath(pathname));
              }}
              className="text-[12px] text-text-muted hover:text-white transition-colors lg:hidden"
              aria-label="Назад"
            >
              ← Назад
            </button>
            <span
              className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-[15px] font-semibold tracking-[0.28em] text-transparent"
              style={{ letterSpacing: "0.28em" }}
            >
              OMF 2026
            </span>
            <div className="w-[44px]" />
          </div>

          <div className="space-y-2">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-gradient-to-r from-white/[0.06] via-white/10 to-white/[0.06]">
              <motion.div
                key={activeIndex}
                className="relative z-[1] h-full origin-left rounded-full bg-gradient-to-r from-[color:var(--tg-theme-button-color,#4F46E5)] via-indigo-400/90 to-[#7C3AED]"
                style={{
                  boxShadow:
                    "2px 0 14px color-mix(in srgb, var(--tg-theme-button-color, #a5b4fc) 38%, transparent)"
                }}
                initial={{ width: `${progress}%`, scaleX: 0.94, opacity: 0.92 }}
                animate={{ width: `${progress}%`, scaleX: 1, opacity: 1 }}
                transition={SPRING_PROGRESS}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-white/35">
              <span>{CREATE_FLOW_STEPS[activeIndex]?.label ?? "Шаг"}</span>
              <span>
                {Math.min(activeIndex + 1, CREATE_FLOW_STEPS.length)}/{CREATE_FLOW_STEPS.length}
              </span>
            </div>
          </div>
        </header>

        {/* Шаги мастера: направление анимации зависит от вперёд/назад */}
        <CreateStepTransition>
          <div className="flex flex-col gap-4">
            {title && (
              <h1 className="text-[20px] font-semibold tracking-tight">{title}</h1>
            )}
            {children}
          </div>
        </CreateStepTransition>

      </div>
    </div>
  );
}
