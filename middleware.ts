import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseMiddleware } from "@/lib/supabase";

/**
 * Middleware для защиты приватных роутов
 * - Telegram Mini App: пропускается (определяем по заголовкам или отсутствию web auth)
 * - Web: проверяем Supabase auth через cookies
 * - Незалогиненные web пользователи → редирект на /login
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /** `public/sw-audio.js` — иначе без сессии приходит 307 на /login и SW регистрируется битым (ломает веб/Safari). */
  if (pathname === "/sw-audio.js") {
    return NextResponse.next();
  }

  // Публичные роуты - доступны всем
  const publicPaths = [
    "/login",
    "/auth/signup",
    "/auth/confirm",
    "/auth/reset-password",
    "/auth/update-password"
  ];
  const isPublicPath = 
    pathname === "/" || 
    publicPaths.some(path => pathname.startsWith(path));

  if (isPublicPath) {
    return NextResponse.next();
  }

  /** Playwright / локальный dev: тот же `devUserId`, что и для API-заголовков (см. e2e/release-wizard.spec.ts). */
  const allowDevE2e = process.env.NEXT_PUBLIC_ALLOW_DEV_API_AUTH === "true";
  const devUserIdParam = request.nextUrl.searchParams.get("devUserId");
  if (
    allowDevE2e &&
    devUserIdParam != null &&
    Number.isFinite(Number(devUserIdParam)) &&
    Number(devUserIdParam) > 0
  ) {
    return NextResponse.next();
  }

  /**
   * Раньше любой запрос с «telegram» в User-Agent обходил проверку web-сессии — это позволяло
   * подделать UA и зайти на /library без логина. Mini App работает по известным префиксам;
   * остальные пути требуют cookie-сессии Supabase как у обычного web.
   */
  function isTelegramMiniAppShellPath(p: string): boolean {
    if (p === "/" || p === "") return true;
    const roots = ["library", "release", "create", "settings", "dashboard", "onboarding", "admin"];
    return roots.some((r) => p === `/${r}` || p.startsWith(`/${r}/`));
  }

  const userAgent = request.headers.get("user-agent") || "";
  const isTelegramUserAgent = userAgent.toLowerCase().includes("telegram");

  if (isTelegramUserAgent && (pathname.startsWith("/api/") || isTelegramMiniAppShellPath(pathname))) {
    return NextResponse.next();
  }

  // Для обычных веб-пользователей проверяем auth через cookies
  const response = NextResponse.next();
  const supabase = createSupabaseMiddleware(request, response);

  try {
    const { data: { session } } = await supabase.auth.getSession();

    // Если нет сессии - редирект на login
    if (!session) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      // Сохраняем куда пользователь хотел попасть
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  } catch (error) {
    console.error("[middleware] Auth check error:", error);
    // В случае ошибки редиректим на login
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }
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
