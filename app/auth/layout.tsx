import type { ReactNode } from "react";

/**
 * Layout для auth-страниц (login, signup, reset-password, etc.)
 * Без AdaptiveLayout и навигации - чистый layout только с базовыми стилями
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
