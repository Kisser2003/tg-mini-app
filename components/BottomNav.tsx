"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Library, Shield, Wallet } from "lucide-react";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { isAdminUi } from "@/lib/admin";
import { hapticMap } from "@/lib/haptic-map";
import { SPRING_UI } from "@/lib/motion-spring";
import { initTelegramWebApp } from "@/lib/telegram";

const MAG_MAX_PX = 6;

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
  const btnRef = useRef<HTMLButtonElement>(null);
  const [mag, setMag] = useState({ x: 0, y: 0 });

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const nx = (e.clientX - cx) / (r.width / 2);
    const ny = (e.clientY - cy) / (r.height / 2);
    setMag({
      x: Math.max(-1, Math.min(1, nx)) * MAG_MAX_PX,
      y: Math.max(-1, Math.min(1, ny)) * MAG_MAX_PX
    });
  }, []);

  const onPointerLeave = useCallback(() => {
    setMag({ x: 0, y: 0 });
  }, []);

  return (
    <motion.button
      ref={btnRef}
      type="button"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      whileTap={{ scale: 0.92 }}
      transition={SPRING_UI}
      onClick={onNavigate}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] transition-colors ${
        active ? "text-white" : "text-white/60 hover:text-white"
      }`}
    >
      <div className="relative flex h-10 w-full items-center justify-center">
        {active && (
          <motion.div
            layoutId="activeTab"
            className="absolute left-1/2 top-1/2 h-9 w-11 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white/15"
            style={{
              boxShadow:
                "0 0 22px color-mix(in srgb, var(--tg-theme-button-color, #3390ec) 42%, transparent), inset 0 1px 0 rgba(255,255,255,0.12)"
            }}
            transition={SPRING_UI}
          />
        )}
        <span
          className="relative z-10 flex items-center justify-center will-change-transform"
          style={{ transform: `translate(${mag.x}px, ${mag.y}px)` }}
        >
          <span
            className="rounded-full p-1"
            style={
              active
                ? {
                    filter:
                      "drop-shadow(0 0 10px color-mix(in srgb, var(--tg-theme-button-color, #3390ec) 50%, transparent))"
                  }
                : undefined
            }
          >
            <Icon className="h-4 w-4" />
          </span>
        </span>
      </div>
      <span className="relative z-10">{item.label}</span>
    </motion.button>
  );
}

export function BottomNav() {
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
  const navVisible = useScrollDirection({
    enabled: scrollHideEnabled,
    pathname,
    threshold: 16
  });

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-[450px] -translate-x-1/2 pb-[env(safe-area-inset-bottom,0px)]"
    >
      <motion.div
        initial={false}
        animate={{ y: navVisible ? 0 : "115%" }}
        transition={{ type: "tween", ease: "circOut", duration: 0.2 }}
        className="will-change-transform"
        style={{ willChange: "transform" }}
      >
        <div
          className="grid gap-1 rounded-[24px] border-t border-white/10 border-x border-b border-white/[0.06] bg-black/60 p-2 backdrop-blur-xl shadow-[0_-8px_32px_rgba(0,0,0,0.45)]"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
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
