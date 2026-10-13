"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Disc3, Shield, CircleHelp, Link2 } from "lucide-react";
import { isAdminUi, isAdminUiByWebSession } from "@/lib/admin";
import { hapticMap } from "@/lib/haptic-map";
import { useHideOnScrollDown } from "@/lib/hooks/useHideOnScrollDown";
import { initTelegramWebApp } from "@/lib/telegram";

type NavTab = {
  path: string;
  icon: LucideIcon;
  label: string;
};

function isTabActive(pathname: string, path: string): boolean {
  if (path === "/library") {
    return pathname === "/library" || pathname === "/";
  }
  return pathname === path;
}

const BottomNavInner = memo(function BottomNavInner() {
  const pathname = usePathname();
  const barVisible = useHideOnScrollDown();
  const [showAdminTab, setShowAdminTab] = useState(false);
  
  // Hooks must be called before any conditional returns
  useEffect(() => {
    initTelegramWebApp();
    setShowAdminTab(isAdminUi());
    void (async () => {
      const webAdmin = await isAdminUiByWebSession();
      if (webAdmin) setShowAdminTab(true);
    })();
  }, []);

  const tabs = useMemo<NavTab[]>(
    () => [
      { path: "/library", icon: Disc3, label: "Релизы" },
      { path: "/multi-links", icon: Link2, label: "Ссылки" },
      { path: "/requirements", icon: CircleHelp, label: "Помощь" },
      ...(showAdminTab ? [{ path: "/admin", icon: Shield, label: "Модерация" }] : [])
    ],
    [showAdminTab]
  );

  // Hide on auth pages (after all hooks)
  if (pathname === "/login") {
    return null;
  }

  /**
   * Бар всегда в DOM и только уезжает вниз: раньше он размонтировался на каждый скролл,
   * и индикатор активного таба терял позицию (layoutId «прыгал» при возврате).
   */
  return (
    <nav className="pointer-events-none fixed bottom-0 left-0 right-0 z-50" aria-label="Основная навигация">
      <motion.div
        initial={false}
        animate={{ y: barVisible ? 0 : "110%" }}
        transition={{ type: "spring", stiffness: 420, damping: 40, mass: 0.9 }}
        aria-hidden={barVisible ? undefined : true}
        className={`border-t border-omf-line bg-omf-bg pb-[env(safe-area-inset-bottom,0px)] ${
          barVisible ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
          {tabs.map((tab) => {
            const isActive = isTabActive(pathname, tab.path);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.path}
                href={tab.path}
                aria-current={isActive ? "page" : undefined}
                tabIndex={barVisible ? undefined : -1}
                onClick={() => {
                  if (!isActive) hapticMap.selection();
                }}
                className={`omf-focus group relative flex min-w-0 flex-1 flex-col items-center gap-1 pb-2 pt-2.5 transition-colors duration-150 [-webkit-tap-highlight-color:transparent] ${
                  isActive ? "text-omf-ink" : "text-omf-graphite hover:text-omf-ink"
                }`}
              >
                {isActive ? (
                  <motion.span
                    layoutId="activeTab"
                    className="absolute inset-x-0 top-0 mx-auto h-[2px] w-8 rounded-full bg-omf-ink"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    aria-hidden
                  />
                ) : null}
                <span
                  className="flex transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-active:scale-[0.84] group-active:duration-75"
                  aria-hidden
                >
                  <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                </span>
                <span className={`text-[11px] ${isActive ? "font-medium" : ""}`}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </motion.div>
    </nav>
  );
});

export const BottomNav = BottomNavInner;
