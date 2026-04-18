"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { LayoutDashboard, Shield, LogOut, Music } from "lucide-react";
import { useLogout } from "@/lib/hooks/useWebAuth";
import { motion } from "framer-motion";
import { isAdminUi } from "@/lib/admin";
import { initTelegramWebApp } from "@/lib/telegram";

/**
 * Боковая навигация для веб-версии (desktop)
 */
export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useLogout();

  const showAdminTab = useMemo(() => {
    initTelegramWebApp();
    return isAdminUi();
  }, []);

  const navItems = useMemo(
    () => [
      { path: "/", icon: LayoutDashboard, label: "Релизы" },
      { path: "/library", icon: Music, label: "Библиотека" },
      ...(showAdminTab ? [{ path: "/admin", icon: Shield, label: "Админка" }] : [])
    ],
    [showAdminTab]
  );

  // Скрываем на странице логина
  if (pathname === "/login") {
    return null;
  }

  return (
    <aside className="fixed bottom-0 left-0 top-[var(--safe-top)] z-50 hidden w-64 flex-col border-r border-white/5 bg-black/40 backdrop-blur-xl lg:flex">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <h1 className="text-2xl font-display font-bold gradient-text">
          omf
        </h1>
        <p className="text-sm text-white/40 mt-1">Music Distribution</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;

          return (
            <Link key={item.path} href={item.path}>
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
