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
      <div className="relative z-[1] w-full min-h-[100dvh] flex">
        <Sidebar />
        <div className="flex-1 ml-0 lg:ml-64">
          <div
            id="app-main-scroll"
            className="app-main-scroll relative px-4 md:px-8 lg:px-12 py-6 md:py-8 max-w-[1400px]"
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
    // Telegram Mini App: узкий mobile layout
    return (
      <div className="relative z-[1] mx-auto w-full max-w-[450px] min-h-[100dvh]">
        <div
          id="app-main-scroll"
          className="app-main-scroll relative px-3 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-4"
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
    <div className="relative z-[1] w-full min-h-[100dvh] flex">
      <Sidebar />
      <div className="flex-1 ml-0 lg:ml-64">
        <div
          id="app-main-scroll"
          className="app-main-scroll relative px-4 md:px-8 lg:px-12 py-6 md:py-8 max-w-[1400px]"
        >
          {children}
        </div>
      </div>
      <FAB />
    </div>
  );
}
