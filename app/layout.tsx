import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Toaster } from "sonner";
import { Inter } from "next/font/google";
import { AppProviders } from "@/components/AppProviders";
import { AppErrorBoundary } from "@/components/ErrorBoundary";
import { PageTransition } from "@/components/PageTransition";
import { TelegramBootstrap } from "@/components/TelegramBootstrap";
import { BottomNavHost } from "@/components/BottomNavHost";
import { NoiseOverlay } from "@/components/NoiseOverlay";
import { FeedbackButton } from "@/components/FeedbackButton";

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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "omf mini app",
  description: "Премиальный Telegram Mini App для музыкальной дистрибуции"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#030303"
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
        className={`${inter.variable} bg-[#030303] font-sans text-white antialiased`}
        style={{ backgroundColor: "#030303", color: "#fff" }}
      >
        <TelegramBootstrap />
        <Toaster richColors expand position="top-center" />
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <div className="relative mx-auto w-full max-w-[450px]">
          <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-[#030303]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(29,78,216,0.15),transparent_55%),radial-gradient(circle_at_80%_25%,rgba(88,28,135,0.15),transparent_50%),radial-gradient(circle_at_50%_90%,rgba(37,99,235,0.1),transparent_45%)]" />
          </div>
          <div
            id="app-main-scroll"
            className="app-main-scroll relative px-3 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-4"
          >
            <NoiseOverlay />
            <AppProviders>
              <AppErrorBoundary>
                <PageTransition>{children}</PageTransition>
              </AppErrorBoundary>
            </AppProviders>
          </div>
          <FeedbackButton />
          <BottomNavHost />
        </div>
      </body>
    </html>
  );
}
