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

  /**
   * Не проверять auth для статики и внутренних маршрутов Next.
   * Matcher с regex может на части деплоев/версий Next давать ложное совпадение — явный префикс надёжнее.
   */
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/_vercel") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw-audio.js"
  ) {
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
    /* Весь `/_next/*` исключаем через префикс — проще чем несколько альтернатив в lookahead. */
    "/((?!_next/|_vercel|favicon\\.ico|robots\\.txt|manifest\\.webmanifest|sw-audio\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
  ]
};
