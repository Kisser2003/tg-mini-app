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
import { triggerHaptic } from "@/lib/telegram";

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

  return (
    <div className="min-h-screen bg-background px-5 py-6 pb-10 text-text">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-5 font-sans">

        {/* Static shell header — does not re-animate on step changes */}
        <header className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                router.push(getCreateBackPath(pathname));
              }}
              className="text-[12px] text-text-muted hover:text-white transition-colors"
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
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
              <motion.div
                className="h-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
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
