"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Shield,
  LogOut,
  CircleHelp,
  List,
  FileText,
  Clock3,
  Link2,
  Megaphone,
  ChevronDown
} from "lucide-react";
import { useLogout } from "@/lib/hooks/useWebAuth";
import { isAdminUi, isAdminUiByWebSession } from "@/lib/admin";
import { initTelegramWebApp } from "@/lib/telegram";
import { cn } from "@/lib/utils";

const LS_RELEASES_OPEN = "omf.sidebar.releasesOpen";
const LS_MARKETING_OPEN = "omf.sidebar.marketingOpen";

/**
 * Боковая навигация для веб-версии (desktop)
 */
export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useLogout();
  const [showAdminTab, setShowAdminTab] = useState(false);
  const [releaseView, setReleaseView] = useState<"all" | "drafts" | "moderation">("all");
  const [releasesOpen, setReleasesOpen] = useState(true);
  const [marketingOpen, setMarketingOpen] = useState(true);

  useEffect(() => {
    initTelegramWebApp();
    setShowAdminTab(isAdminUi());
    void (async () => {
      const webAdmin = await isAdminUiByWebSession();
      if (webAdmin) setShowAdminTab(true);
    })();
  }, []);

  useEffect(() => {
    try {
      const r = localStorage.getItem(LS_RELEASES_OPEN);
      const m = localStorage.getItem(LS_MARKETING_OPEN);
      if (r !== null) setReleasesOpen(r === "1");
      if (m !== null) setMarketingOpen(m === "1");
    } catch {
      /* ignore */
    }
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
      { path: "/requirements", icon: CircleHelp, label: "Помощь" },
      ...(showAdminTab ? [{ path: "/admin", icon: Shield, label: "Модерация" }] : [])
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

  const itemClass = (active: boolean) =>
    cn(
      "omf-focus relative flex items-center gap-3 rounded-control px-3 py-2.5 text-[15px] transition-colors",
      active ? "bg-omf-surface font-medium text-omf-ink" : "text-omf-graphite hover:bg-omf-surface hover:text-omf-ink"
    );

  const groupButton = "omf-focus flex w-full items-center gap-2 rounded-control px-2 py-2 text-left text-[13px] text-omf-graphite transition-colors hover:text-omf-ink";

  return (
    <aside className="fixed bottom-0 left-0 top-[var(--safe-top)] z-50 hidden w-64 flex-col border-r border-omf-line bg-omf-bg lg:flex">
      <div className="border-b border-omf-line p-6">
        <p className="text-[24px] font-extrabold tracking-[-0.04em] text-omf-ink">OMF</p>
        <p className="mt-0.5 text-[13px] text-omf-graphite">Выпуск музыки</p>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-4" aria-label="Основная навигация">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              setReleasesOpen((v) => {
                const next = !v;
                try {
                  localStorage.setItem(LS_RELEASES_OPEN, next ? "1" : "0");
                } catch {
                  /* ignore */
                }
                return next;
              });
            }}
            aria-expanded={releasesOpen}
            className={groupButton}
          >
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform duration-200", !releasesOpen && "-rotate-90")}
              aria-hidden
            />
            <span className="min-w-0 flex-1">Релизы</span>
          </button>
          {releasesOpen
            ? releaseViews.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === "/library" && releaseView === item.view;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setReleaseView(item.view)}
                    aria-current={isActive ? "page" : undefined}
                    className={itemClass(isActive)}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                    {item.label}
                  </Link>
                );
              })
            : null}
        </div>

        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              setMarketingOpen((v) => {
                const next = !v;
                try {
                  localStorage.setItem(LS_MARKETING_OPEN, next ? "1" : "0");
                } catch {
                  /* ignore */
                }
                return next;
              });
            }}
            aria-expanded={marketingOpen}
            className={groupButton}
          >
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform duration-200", !marketingOpen && "-rotate-90")}
              aria-hidden
            />
            <span className="min-w-0 flex-1">Продвижение</span>
          </button>
          {marketingOpen ? (
            <Link
              href="/multi-links"
              aria-current={pathname === "/multi-links" ? "page" : undefined}
              className={itemClass(pathname === "/multi-links")}
            >
              <Link2 className="h-[18px] w-[18px]" aria-hidden />
              Ссылки на релизы
            </Link>
          ) : null}
          {marketingOpen ? (
            <Link
              href="/pitching"
              aria-current={pathname === "/pitching" ? "page" : undefined}
              className={itemClass(pathname === "/pitching")}
            >
              <Megaphone className="h-[18px] w-[18px]" aria-hidden />
              Питчинг
            </Link>
          ) : null}
        </div>

        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={`${item.path}-${item.label}`}
                href={item.path}
                aria-current={isActive ? "page" : undefined}
                className={itemClass(isActive)}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-omf-line p-4">
        <button
          type="button"
          onClick={logout}
          className="omf-focus flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-[15px] text-omf-graphite transition-colors hover:bg-omf-surface hover:text-omf-ink"
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden />
          Выйти
        </button>
      </div>
    </aside>
  );
}
