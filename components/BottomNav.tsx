"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Shield, CircleHelp, Link2 } from "lucide-react";
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
      { path: "/library", icon: LayoutDashboard, label: "Релизы" },
      { path: "/multi-links", icon: Link2, label: "Ссылки" },
      { path: "/requirements", icon: CircleHelp, label: "FAQ" },
      ...(showAdminTab ? [{ path: "/admin", icon: Shield, label: "Админ" }] : [])
    ],
    [showAdminTab]
  );

  // Hide on auth pages (after all hooks)
  if (pathname === "/login") {
    return null;
  }

  return (
    <nav className="pointer-events-none fixed bottom-0 left-0 right-0 z-50" aria-label="Основная навигация">
      <AnimatePresence initial={false}>
        {barVisible ? (
          <motion.div
            key="bottom-nav-bar"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 110, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="pointer-events-auto mx-4 mb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
          >
            <div
              className="glass flex items-center justify-around px-3 py-2.5"
              style={{
                borderRadius: "1.25rem",
                background: "rgba(255,255,255,0.03)",
                backdropFilter: "blur(32px) saturate(1.4)",
                WebkitBackdropFilter: "blur(32px) saturate(1.4)"
              }}
            >
              {tabs.map((tab) => {
                const isActive = isTabActive(pathname, tab.path);
                const Icon = tab.icon;

                return (
                  <Link
                    key={tab.path}
                    href={tab.path}
                    onClick={() => {
                      if (!isActive) hapticMap.impactLight();
                    }}
                    className="relative flex min-w-0 flex-1 flex-col items-center gap-1 px-2 py-1.5 sm:px-4"
                  >
                    {isActive ? (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 rounded-xl"
                        style={{
                          background: "rgba(129, 140, 248, 0.08)",
                          boxShadow: "0 0 20px rgba(129, 140, 248, 0.1)"
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    ) : null}
                    <Icon
                      size={18}
                      className={`relative z-10 transition-colors duration-200 ${
                        isActive ? "text-[#818cf8]" : "text-white/25"
                      }`}
                      strokeWidth={2}
                    />
                    <span
                      className={`relative z-10 text-[10px] font-semibold tracking-wide transition-colors duration-200 ${
                        isActive ? "text-[#818cf8]" : "text-white/25"
                      }`}
                    >
                      {tab.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  );
});

export const BottomNav = BottomNavInner;
