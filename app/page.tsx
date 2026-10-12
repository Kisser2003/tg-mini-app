"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useIsTelegramMiniApp,
  checkIsTelegramMiniApp
} from "@/lib/hooks/useIsTelegramMiniApp";
import { appendCurrentTelegramHash } from "@/lib/telegram";
import { LoadingScreen } from "@/components/LoadingScreen";

/**
 * Root page - smart redirect based on authentication
 * - Authenticated users → /library (main dashboard)
 * - Unauthenticated users → /login
 */
export default function HomePage() {
  const router = useRouter();
  const isTelegram = useIsTelegramMiniApp();
  const [webAuthState, setWebAuthState] = useState<"loading" | "authed" | "guest">("loading");

  useEffect(() => {
    // Telegram first-load path: redirect ASAP, skip web auth bootstrap.
    if (typeof window !== "undefined" && checkIsTelegramMiniApp()) {
      window.location.replace(appendCurrentTelegramHash("/library"));
      return;
    }
    if (isTelegram) {
      window.location.replace(appendCurrentTelegramHash("/library"));
      return;
    }
    let active = true;

    // Web-only fallback: resolve auth lazily to keep Telegram entry faster.
    void (async () => {
      const { createSupabaseBrowser } = await import("@/lib/supabase");
      const supabase = createSupabaseBrowser();
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!active) return;
      setWebAuthState(session?.user ? "authed" : "guest");
    })();

    return () => {
      active = false;
    };
  }, [isTelegram]);

  useEffect(() => {
    if (webAuthState === "loading") return;
    if (webAuthState === "authed") {
      router.replace(appendCurrentTelegramHash("/library"));
      return;
    }
    router.replace(appendCurrentTelegramHash("/login"));
  }, [webAuthState, router]);

  return <LoadingScreen />;
}
