"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useHaptics } from "@/lib/hooks/useHaptics";
import { useHideOnScrollDown } from "@/lib/hooks/useHideOnScrollDown";
import { useIsTelegramMiniApp } from "@/lib/hooks/useIsTelegramMiniApp";

/** Floating action — Lovable FAB, routes to create flow (hidden on wizard). */
export function FAB() {
  const router = useRouter();
  const pathname = usePathname();
  const haptics = useHaptics();
  const fabVisible = useHideOnScrollDown();
  const isTelegram = useIsTelegramMiniApp();
  /* On web desktop (lg+), sidebar has its own create CTA — FAB not needed */
  /* We detect this via isTelegram: if not Telegram and screen is wide, hide */
  /* Use a window width check after mount */
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (pathname?.startsWith("/create")) {
    return null;
  }
  /* Admin routes should never show create FAB */
  if (pathname?.startsWith("/admin")) {
    return null;
  }
  /* Library uses top icon-row + optional global FAB elsewhere */
  if (pathname === "/" || pathname === "/library") {
    return null;
  }
  /* Карточка релиза: только просмотр, новый релиз из FAB не нужен */
  if (pathname?.startsWith("/release/")) {
    return null;
  }
  /* FAQ / мультиссылки: на телефоне FAB перекрывает контент и нижнюю навигацию */
  if (pathname === "/requirements" || pathname === "/multi-links") {
    return null;
  }
  /* Hide on auth pages */
  if (pathname === "/login") {
    return null;
  }

  if (!isTelegram && isDesktop) return null;

  return (
    <AnimatePresence initial={false}>
      {fabVisible ? (
        <motion.button
          key="fab"
          type="button"
          aria-label="Новый релиз"
          initial={{ scale: 0.85, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 28 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          onClick={() => {
            haptics.impactLight();
            router.push("/create/metadata");
          }}
          className="pulse-glow fixed z-[55] flex h-[60px] w-[60px] items-center justify-center rounded-full text-white"
          style={{
            bottom: isTelegram
              ? "calc(var(--bottom-nav-height, 4.5rem) + 0.75rem + env(safe-area-inset-bottom, 0px))"
              : "2rem",
            right: isTelegram ? "1.25rem" : "2rem",
            background:
              "linear-gradient(135deg, var(--ss-neon-blue), var(--ss-neon-pink))",
            border: "0.5px solid rgba(255,255,255,0.15)"
          }}
          whileTap={{ scale: 0.85 }}
          whileHover={{ scale: 1.08 }}
        >
          <Plus size={26} strokeWidth={2.5} />
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
