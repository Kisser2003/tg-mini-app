"use client";

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
  /* Hide on auth pages */
  if (pathname === "/login") {
    return null;
  }

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
            background: "linear-gradient(135deg, #818cf8, #c084fc)",
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
