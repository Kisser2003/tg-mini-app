"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import {
  CREATE_FLOW_STEPS,
  getCreateBackPath,
  getCreateStepIndexFromPath
} from "@/lib/create-steps";
import { CreateStepTransition } from "@/features/release/createRelease/components/CreateStepTransition";
import { useHaptics } from "@/lib/hooks/useHaptics";
import { useTelegramBackButton } from "@/lib/hooks/useTelegramBackButton";
import { getTelegramWebApp } from "@/lib/telegram";

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

  const activeIndex = useMemo(() => getCreateStepIndexFromPath(pathname), [pathname]);

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

  return (
    <div className="min-h-[100dvh] px-5 pb-10 pt-14 text-foreground">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-5 font-sans">
        <header className="space-y-8">
          <div className="flex items-center gap-3">
            <motion.button
              type="button"
              onClick={goBack}
              whileTap={{ scale: 0.88 }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04] text-white/60"
              aria-label="Назад"
            >
              <ArrowLeft size={17} strokeWidth={2} />
            </motion.button>
            <h1 className="font-display text-xl font-bold tracking-tight text-white/90">
              Новый релиз
            </h1>
          </div>

          <div className="flex gap-2">
            {CREATE_FLOW_STEPS.map((s, i) => (
              <div key={s.key} className="min-w-0 flex-1">
                <div className="h-[2px] overflow-hidden rounded-full bg-white/[0.04]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, #818cf8, #c084fc)" }}
                    initial={{ width: "0%" }}
                    animate={{ width: i <= activeIndex ? "100%" : "0%" }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <p
                  className={`mt-2.5 text-[8px] font-semibold uppercase leading-tight tracking-[0.12em] sm:text-[9px] sm:tracking-[0.15em] ${
                    i <= activeIndex ? "text-[#818cf8]" : "text-white/15"
                  }`}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </header>

        <CreateStepTransition>
          <div className="flex flex-col gap-4">
            {title ? (
              <h2 className="text-[17px] font-semibold tracking-tight text-white/90">{title}</h2>
            ) : null}
            {children}
          </div>
        </CreateStepTransition>
      </div>
    </div>
  );
}
