import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Toaster } from "sonner";
import { Inter, Space_Grotesk } from "next/font/google";
import { AppProviders } from "@/components/AppProviders";
import { AppErrorBoundary } from "@/components/ErrorBoundary";
import { PageTransition } from "@/components/PageTransition";
import { InputFocusScroll } from "@/components/InputFocusScroll";
import { TelegramBootstrap } from "@/components/TelegramBootstrap";
import { AdaptiveLayout } from "@/components/AdaptiveLayout";
import { NoiseOverlay } from "@/components/NoiseOverlay";
function supabasePreconnectOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "omf mini app",
  description: "Премиальный Telegram Mini App для музыкальной дистрибуции",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent"
  }
};

/**
 * Viewport + theme-color: верхний край градиента (--theme-color-status) для стыка со статус-баром Safari.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
    { color: "#0a0a0f" }
  ]
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const supabaseOrigin = supabasePreconnectOrigin();

  return (
    <html lang="ru" className="dark">
      <head>
        {supabaseOrigin ? (
          <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
        ) : null}
      </head>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} font-sans text-foreground antialiased`}
        style={{
          ["--bottom-nav-height" as string]: "4.5rem"
        }}
      >
        <TelegramBootstrap />
        <InputFocusScroll />
        <Toaster richColors expand position="top-center" />
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <div className="mesh-bg" aria-hidden>
          <div className="light-hero" />
          <div className="light-fab" />
        </div>
        <div className="app-safe-shell">
          <AppProviders>
            <AppErrorBoundary>
              <AdaptiveLayout>
                <PageTransition>{children}</PageTransition>
              </AdaptiveLayout>
            </AppErrorBoundary>
          </AppProviders>
        </div>
        <NoiseOverlay />
      </body>
    </html>
  );
}
