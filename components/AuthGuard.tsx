"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsTelegramMiniApp } from "@/lib/hooks/useIsTelegramMiniApp";
import { useWebAuth } from "@/lib/hooks/useWebAuth";
import { LoadingScreen } from "./LoadingScreen";

/**
 * Компонент для защиты приватных страниц
 * - Telegram Mini App: пропускает сразу
 * - Web: проверяет Supabase auth, редиректит на /login если нет авторизации
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isTelegram = useIsTelegramMiniApp();
  const webUser = useWebAuth({ redirectToLogin: false });

  useEffect(() => {
    // Если не Telegram Mini App и нет web авторизации - редирект
    if (!isTelegram && webUser === undefined) {
      router.replace("/login");
    }
  }, [isTelegram, webUser, router]);

  // Показываем loader пока идет проверка auth (только для web пользователей)
  if (!isTelegram && webUser === null) {
    return <LoadingScreen />;
  }

  // Если не авторизован - не показываем контент (редирект в useEffect)
  if (!isTelegram && webUser === undefined) {
    return null;
  }

  return <>{children}</>;
}
