"use client";

import { memo, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Library, Shield, Wallet } from "lucide-react";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { isAdminUi } from "@/lib/admin";
import { hapticMap } from "@/lib/haptic-map";
import { SPRING_UI } from "@/lib/motion-spring";
import { initTelegramWebApp } from "@/lib/telegram";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

function BottomNavItem({
  item,
  active,
  onNavigate
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      transition={SPRING_UI}
      onClick={onNavigate}
      className={`relative flex min-h-0 min-w-0 flex-col items-center justify-center rounded-2xl px-0 py-2 text-[11px] leading-tight transition-colors ${
        active ? "text-white" : "text-white/60 hover:text-white"
      }`}
    >
      {/* Фиксированный квадрат 40×40: без layoutId — иначе shared layout ломает позицию при transform у предков */}
      <div className="relative mx-auto flex h-10 w-10 shrink-0 items-center justify-center">
        {active ? (
          <div
            className="pointer-events-none absolute inset-0 z-0 rounded-2xl bg-white/15"
            style={{
              boxShadow:
                "0 0 22px color-mix(in srgb, var(--tg-theme-button-color, #3390ec) 42%, transparent), inset 0 1px 0 rgba(255,255,255,0.12)"
            }}
            aria-hidden
          />
        ) : null}
        <span
          className="relative z-10 flex items-center justify-center"
          style={
            active
              ? {
                  filter:
                    "drop-shadow(0 0 10px color-mix(in srgb, var(--tg-theme-button-color, #3390ec) 50%, transparent))"
                }
              : undefined
          }
        >
          <span className="rounded-full p-1">
            <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
          </span>
        </span>
      </div>
      <span className="relative z-10 max-w-full whitespace-nowrap text-center">{item.label}</span>
    </motion.button>
  );
}

function BottomNavInner() {
  const pathname = usePathname();
  const router = useRouter();
  const showAdminTab = useMemo(() => {
    initTelegramWebApp();
    return isAdminUi();
  }, []);

  const items = useMemo<NavItem[]>(
    () => [
      { label: "Мои релизы", href: "/library", icon: Library },
      { label: "Кошелек", href: "/wallet", icon: Wallet },
      ...(showAdminTab ? [{ label: "Админ", href: "/admin", icon: Shield }] : [])
    ],
    [showAdminTab]
  );

  const scrollHideEnabled = pathname !== "/create/success";
  const scrollNavVisible = useScrollDirection({
    enabled: scrollHideEnabled,
    pathname,
    threshold: 16
  });

  const isKeyboardOpen = useKeyboardVisible();

  if (isKeyboardOpen) {
    return null;
  }

  const showBar = scrollNavVisible;

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed bottom-0 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-[450px] -translate-x-1/2 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2"
      style={{ ["--bottom-nav-height" as string]: "4.5rem" }}
    >
      <motion.div
        initial={false}
        animate={{ y: showBar ? 0 : "115%" }}
        transition={{ type: "tween", ease: "circOut", duration: 0.2 }}
        className="will-change-transform"
        style={{ willChange: "transform" }}
      >
        <div className="grid w-full grid-cols-3 rounded-[24px] border border-white/[0.06] border-t-white/10 bg-black/60 p-2 backdrop-blur-xl shadow-[0_-8px_32px_rgba(0,0,0,0.45)]">
          {items.map((item) => {
            const active =
              item.href === "/library"
                ? pathname === "/library" || pathname === "/"
                : pathname === item.href;

            return (
              <BottomNavItem
                key={item.href}
                item={item}
                active={active}
                onNavigate={() => {
                  if (!active) hapticMap.impactLight();
                  router.push(item.href);
                }}
              />
            );
          })}
        </div>
      </motion.div>
    </nav>
  );
}

export const BottomNav = memo(BottomNavInner);
