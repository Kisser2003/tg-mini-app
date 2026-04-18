"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useIsTelegramMiniApp } from "@/lib/hooks/useIsTelegramMiniApp";
import { BottomNavHost } from "./BottomNavHost";
import { FAB } from "./FAB";
import { Sidebar } from "./Sidebar";

/**
 * Адаптивный layout: Telegram Mini App vs Web
 * - Telegram: max-w-[450px], bottom navigation
 * - Web: полный экран, sidebar навигация
 * - Public pages (login): no sidebar, centered content
 */
export function AdaptiveLayout({ children }: { children: React.ReactNode }) {
  const isTelegram = useIsTelegramMiniApp();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // Public pages without navigation
  const isPublicPage = 
    pathname === "/login" || 
    pathname.startsWith("/auth/");

  // Prevent hydration mismatch by rendering universal layout first
  useEffect(() => {
    setMounted(true);
  }, []);

  // Public page layout (no sidebar, no navigation)
  if (isPublicPage) {
    return <>{children}</>;
  }

  // During SSR and initial mount, render universal layout
  if (!mounted) {
    return (
      <div className="relative z-[1] flex w-full min-h-app">
        <Sidebar />
        <div className="ml-0 flex-1 lg:ml-64">
          <div
            id="app-main-scroll"
            className="app-main-scroll relative max-w-[1400px] px-4 py-6 md:px-8 md:py-8 lg:px-12"
          >
            {children}
          </div>
        </div>
        <FAB />
      </div>
    );
  }

  // After hydration, render adaptive layout
  if (isTelegram) {
    // Telegram Mini App: узкий mobile layout (нижний inset — в .app-safe-shell + fixed nav)
    return (
      <div className="relative z-[1] mx-auto min-h-app w-full max-w-[450px]">
        <div
          id="app-main-scroll"
          className="app-main-scroll relative px-3 pb-28 pt-4"
        >
          {children}
        </div>
        <BottomNavHost />
        <FAB />
      </div>
    );
  }

  // Web: полноценный desktop layout с sidebar
  return (
    <div className="relative z-[1] flex min-h-app w-full">
      <Sidebar />
      <div className="ml-0 flex-1 lg:ml-64">
        <div
          id="app-main-scroll"
          className="app-main-scroll relative max-w-[1400px] px-4 py-6 md:px-8 md:py-8 lg:px-12"
        >
          {children}
        </div>
      </div>
      <FAB />
    </div>
  );
}
