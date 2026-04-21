"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Shield, LogOut, CircleHelp, FileMusic, List, FileText, Clock3 } from "lucide-react";
import { useLogout } from "@/lib/hooks/useWebAuth";
import { motion } from "framer-motion";
import { isAdminUi, isAdminUiByWebSession } from "@/lib/admin";
import { initTelegramWebApp } from "@/lib/telegram";

/**
 * Боковая навигация для веб-версии (desktop)
 */
export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useLogout();
  const [showAdminTab, setShowAdminTab] = useState(false);
  const [releaseView, setReleaseView] = useState<"all" | "drafts" | "moderation">("all");

  useEffect(() => {
    initTelegramWebApp();
    setShowAdminTab(isAdminUi());
    void (async () => {
      const webAdmin = await isAdminUiByWebSession();
      if (webAdmin) setShowAdminTab(true);
    })();
  }, []);

  useEffect(() => {
    if (pathname !== "/library") {
      setReleaseView("all");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    if (view === "drafts" || view === "moderation") {
      setReleaseView(view);
      return;
    }
    setReleaseView("all");
  }, [pathname]);

  const navItems = useMemo(
    () => [
      { path: "/requirements", icon: CircleHelp, label: "FAQ" },
      ...(showAdminTab ? [{ path: "/admin", icon: Shield, label: "Админка" }] : [])
    ],
    [showAdminTab]
  );

  const releaseViews = [
    { path: "/library?view=all", icon: List, label: "Все релизы", view: "all" },
    { path: "/library?view=drafts", icon: FileText, label: "Черновики", view: "drafts" },
    { path: "/library?view=moderation", icon: Clock3, label: "Модерация", view: "moderation" }
  ] as const;

  // Скрываем на странице логина
  if (pathname === "/login") {
    return null;
  }

  return (
    <aside className="fixed bottom-0 left-0 top-[var(--safe-top)] z-50 hidden w-64 flex-col border-r border-white/5 bg-black/40 backdrop-blur-xl lg:flex">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <h1 className="text-2xl font-display font-bold gradient-text">
          OMF
        </h1>
        <p className="text-sm text-white/40 mt-1">Music Distribution</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-4 p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-4 py-2 text-white/85">
            <FileMusic className="h-5 w-5" />
            <span className="font-medium">Ваши релизы</span>
          </div>
          <div className="ml-3 border-l border-white/10 pl-3">
            {releaseViews.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === "/library" && releaseView === item.view;

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setReleaseView(item.view)}
                >
                  <motion.div
                    className={`
                      relative mt-1.5 flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all duration-200
                      ${isActive ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5 hover:text-white"}
                    `}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active-sub"
                        className="absolute inset-0 rounded-lg border border-white/10 bg-gradient-to-r from-purple-500/20 to-pink-500/20"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <Icon className="relative h-4 w-4" />
                    <span className="relative text-[14px] font-medium">{item.label}</span>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </div>

        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;

          return (
            <Link key={`${item.path}-${item.label}`} href={item.path}>
              <motion.div
                className={`
                  relative flex items-center gap-3 px-4 py-3 rounded-xl
                  transition-all duration-200
                  ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }
                `}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-white/10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className="relative w-5 h-5" />
                <span className="relative font-medium">{item.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Footer: Logout */}
      <div className="p-4 border-t border-white/5">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Выйти</span>
        </button>
      </div>
    </aside>
  );
}
