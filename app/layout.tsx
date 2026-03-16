import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Release Uploader",
  description: "Telegram Mini App for music release distribution"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <body className="min-h-screen bg-background text-white antialiased">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <div className="mx-auto flex min-h-screen w-full max-w-md items-stretch px-3 py-3 sm:items-center sm:px-4">
          <div className="w-full rounded-3xl border border-zinc-800 bg-surface/90 p-5 shadow-lg shadow-black/40">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}

