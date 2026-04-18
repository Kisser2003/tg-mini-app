"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useIsTelegramMiniApp,
  checkIsTelegramMiniApp
} from "@/lib/hooks/useIsTelegramMiniApp";
import { useWebAuth } from "@/lib/hooks/useWebAuth";
import { LoadingScreen } from "@/components/LoadingScreen";

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
      router.replace("/library");
      return;
    }
    if (isTelegram) {
      router.replace("/library");
      return;
    }

    // Web users
    if (webUser === undefined) {
      // Not authenticated: go to login page with signup hint
      router.replace("/login?mode=signup");
    } else if (webUser) {
      // Authenticated: go to library
      router.replace("/library");
    }
    // webUser === null means loading, show loader
  }, [isTelegram, webUser, router]);

  return <LoadingScreen />;
}
