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

  // Проверяем Telegram Mini App по заголовкам
  // Telegram WebApp добавляет специфичные заголовки или tgWebAppData
  const userAgent = request.headers.get("user-agent") || "";
  const isTelegramUserAgent = userAgent.toLowerCase().includes("telegram");
  
  // Если это похоже на Telegram - пропускаем
  // (дополнительная проверка будет на клиенте в AuthGuard)
  if (isTelegramUserAgent) {
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
