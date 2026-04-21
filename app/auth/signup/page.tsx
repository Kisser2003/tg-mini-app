"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useIsTelegramMiniApp,
  checkIsTelegramMiniApp
} from "@/lib/hooks/useIsTelegramMiniApp";
import { useWebAuth } from "@/lib/hooks/useWebAuth";
import { LoadingScreen } from "@/components/LoadingScreen";
import { appendCurrentTelegramHash } from "@/lib/telegram";

/**
 * Signup route handler
 * - If authenticated: redirect to /library
 * - If not authenticated: redirect to /login with signup mode
 */
export default function SignupPage() {
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
      // Not authenticated: go to login page with signup hint
      router.replace(appendCurrentTelegramHash("/login?mode=signup"));
    } else if (webUser) {
      // Authenticated: go to library
      router.replace(appendCurrentTelegramHash("/library"));
    }
    // webUser === null means loading, show loader
  }, [isTelegram, webUser, router]);

  return <LoadingScreen />;
}
