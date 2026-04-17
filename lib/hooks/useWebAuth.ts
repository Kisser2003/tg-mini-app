"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

/**
 * Hook для проверки веб-авторизации
 * Возвращает null пока идет проверка, User если залогинен, undefined если нет
 */
export function useWebAuth(options?: { redirectToLogin?: boolean }) {
  const [user, setUser] = useState<User | null | undefined>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { redirectToLogin = false } = options || {};

  useEffect(() => {
    const supabase = createSupabaseBrowser();

    // Проверяем текущую сессию
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(undefined);
        if (redirectToLogin && pathname !== "/login") {
          router.replace("/login");
        }
      }
    });

    // Подписываемся на изменения сессии
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(undefined);
        if (redirectToLogin && pathname !== "/login") {
          router.replace("/login");
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [redirectToLogin, router, pathname]);

  return user;
}

/**
 * Hook для logout
 */
export function useLogout() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return { logout };
}
