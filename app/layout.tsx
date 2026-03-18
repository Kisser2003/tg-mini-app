import "./globals.css";
import type { Metadata } from "next";
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

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <body className={`${inter.variable} min-h-screen bg-[#030303] font-sans text-white antialiased`}>
        <TelegramBootstrap />
        <Toaster richColors expand position="top-center" />
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <div className="relative mx-auto min-h-screen w-full max-w-[450px] px-3 pb-28 pt-4">
          <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-[#030303]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(29,78,216,0.15),transparent_55%),radial-gradient(circle_at_80%_25%,rgba(88,28,135,0.15),transparent_50%),radial-gradient(circle_at_50%_90%,rgba(37,99,235,0.1),transparent_45%)]" />
          </div>
          <NoiseOverlay />
          <PageTransition>{children}</PageTransition>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}

