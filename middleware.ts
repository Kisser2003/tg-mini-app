import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Редирект корня на главный экран приложения.
 * Роут `app/page.tsx` тоже делает redirect — дублирование безвредно.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/library", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/"]
};
