"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useIsTelegramMiniApp,
  checkIsTelegramMiniApp
} from "@/lib/hooks/useIsTelegramMiniApp";
import { useWebAuth } from "@/lib/hooks/useWebAuth";
import { useDevE2eAuthBypass } from "@/lib/hooks/useDevE2eAuthBypass";
import { appendCurrentTelegramHash } from "@/lib/telegram";
import { LoadingScreen } from "./LoadingScreen";

/**
 * Компонент для защиты приватных страниц
 * - Telegram Mini App: пропускает сразу
 * - Web: проверяет Supabase auth, редиректит на /login если нет авторизации
 * - Dev/E2E: `NEXT_PUBLIC_ALLOW_DEV_API_AUTH` + `?devUserId=` (см. `useDevE2eAuthBypass`)
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isTelegram = useIsTelegramMiniApp();
  const devE2eBypass = useDevE2eAuthBypass();
  const webUser = useWebAuth({ redirectToLogin: false });

  useEffect(() => {
    // Синхронная подстраховка: хук мог ещё не совпасть с `window` в краевом кадре гидрации.
    if (typeof window !== "undefined" && checkIsTelegramMiniApp()) return;
    if (devE2eBypass) return;
    if (!isTelegram && webUser === undefined) {
      router.replace(appendCurrentTelegramHash("/login"));
    }
  }, [isTelegram, webUser, router, devE2eBypass]);

  if (devE2eBypass || isTelegram) {
    return <>{children}</>;
  }

  // Показываем loader пока идет проверка auth (только для web пользователей)
  if (!isTelegram && webUser === null) {
    return <LoadingScreen />;
  }

  // Нет веб-сессии: редирект на /login в useEffect — не рендерить null (пустой экран в Safari / WebView).
  if (!isTelegram && webUser === undefined) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
