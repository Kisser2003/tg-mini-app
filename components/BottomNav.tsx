"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Library, Settings, Shield, Wallet } from "lucide-react";
import { getExpectedAdminTelegramId } from "@/lib/admin";
import { getTelegramUserId, initTelegramWebApp } from "@/lib/telegram";

type NavItem = {
  label: string;
  href: string;
  icon: typeof Home;
};

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = useMemo(() => {
    initTelegramWebApp();
    return getTelegramUserId() === getExpectedAdminTelegramId();
  }, []);

  const items = useMemo<NavItem[]>(
    () => [
      { label: "Главная", href: "/", icon: Home },
      { label: "Мои релизы", href: "/library", icon: Library },
      { label: "Кошелек", href: "/wallet", icon: Wallet },
      { label: "Настройки", href: "/settings", icon: Settings },
      ...(isAdmin ? [{ label: "Админ", href: "/admin", icon: Shield }] : [])
    ],
    [isAdmin]
  );

  return (
    <nav
      className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-[450px] -translate-x-1/2 pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div
        className="grid gap-1 rounded-[24px] border border-white/10 bg-white/[0.02] p-2 backdrop-blur-3xl"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <motion.button
              key={item.href}
              type="button"
              whileHover={{ scale: 0.99 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] transition-colors ${
                active ? "bg-white/15 text-white" : "text-white/60 hover:text-white"
              }`}
            >
              <span className={active ? "rounded-full p-1 shadow-[0_0_16px_rgba(96,165,250,0.55)]" : "rounded-full p-1"}>
                <Icon className="h-4 w-4" />
              </span>
              <span>{item.label}</span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
