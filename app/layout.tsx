import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Toaster } from "sonner";
import { Inter } from "next/font/google";
import { PageTransition } from "@/components/PageTransition";
import { TelegramBootstrap } from "@/components/TelegramBootstrap";
import { BottomNav } from "@/components/BottomNav";
import { NoiseOverlay } from "@/components/NoiseOverlay";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: "omf mini app",
  description: "Премиальный Telegram Mini App для музыкальной дистрибуции"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <body
        className={`${inter.variable} flex min-h-[100dvh] flex-col overflow-hidden bg-[#030303] font-sans text-white antialiased`}
      >
        <TelegramBootstrap />
        <Toaster richColors expand position="top-center" />
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <div className="relative mx-auto flex min-h-0 w-full max-w-[450px] flex-1 flex-col">
          <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-[#030303]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(29,78,216,0.15),transparent_55%),radial-gradient(circle_at_80%_25%,rgba(88,28,135,0.15),transparent_50%),radial-gradient(circle_at_50%_90%,rgba(37,99,235,0.1),transparent_45%)]" />
          </div>
          <div className="app-main-scroll relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-3 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] pt-4 [-webkit-overflow-scrolling:touch]">
            <NoiseOverlay />
            <PageTransition>{children}</PageTransition>
          </div>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}

