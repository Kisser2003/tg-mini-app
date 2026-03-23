import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Редирект корня на главный экран приложения.
 * Роут `app/page.tsx` тоже делает redirect — дублирование безвредно.
 * `/wallet` — кошелёк заморожен: уводим на библиотеку (см. BottomNav).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/wallet" || pathname.startsWith("/wallet/")) {
    return NextResponse.redirect(new URL("/library", request.url));
  }
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/library", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/wallet", "/wallet/:path*"]
};
