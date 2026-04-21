"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useIsTelegramMiniApp,
  checkIsTelegramMiniApp
} from "@/lib/hooks/useIsTelegramMiniApp";
import { appendCurrentTelegramHash } from "@/lib/telegram";
import { useWebAuth } from "@/lib/hooks/useWebAuth";
import { LoadingScreen } from "@/components/LoadingScreen";

/**
 * Root page - smart redirect based on authentication
 * - Authenticated users → /library (main dashboard)
 * - Unauthenticated users → /login
 */
export default function HomePage() {
  const router = useRouter();
  const isTelegram = useIsTelegramMiniApp();
  const webUser = useWebAuth({ redirectToLogin: false });

  useEffect(() => {
    if (typeof window !== "undefined" && checkIsTelegramMiniApp()) {
      router.replace(appendCurrentTelegramHash("/library"));
      return;
    }
    if (isTelegram) {
      router.replace(appendCurrentTelegramHash("/library"));
      return;
    }

    // Web users
    if (webUser === undefined) {
      // Not authenticated: go to login
      router.replace(appendCurrentTelegramHash("/login"));
    } else if (webUser) {
      // Authenticated: go to library
      router.replace(appendCurrentTelegramHash("/library"));
    }
    // webUser === null means loading, show loader below
  }, [isTelegram, webUser, router]);

  return <LoadingScreen />;
}
