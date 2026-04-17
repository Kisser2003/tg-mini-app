import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware для базового роутинга
 * Auth checks happen on client-side for reliability (Supabase uses localStorage)
 * Pages handle their own auth-aware redirects
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // No server-side redirects - let pages handle auth routing
  // This prevents 404s and allows proper client-side auth checks
  
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
