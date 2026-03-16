import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Release Assistant",
  description: "Telegram Mini App for fast music release preparation"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <body className="min-h-screen bg-background text-text antialiased">
        <Toaster richColors expand position="top-center" />
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <div className="relative mx-auto flex min-h-screen w-full max-w-xl items-stretch px-3 py-4 sm:items-center sm:px-4">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-60">
            <div className="absolute inset-[-120px] bg-[radial-gradient(circle_at_top,_rgba(51,144,236,0.24),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(255,255,255,0.05),_transparent_55%)]" />
          </div>
          <div className="w-full max-w-[520px] rounded-2xl border border-border/70 bg-surface/95 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.75)] backdrop-blur-xl">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}

