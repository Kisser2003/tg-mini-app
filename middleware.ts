import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware для базового роутинга
 * Детальная проверка авторизации происходит на client-side через useWebAuth
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Редирект с корня на /library
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/library", request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
