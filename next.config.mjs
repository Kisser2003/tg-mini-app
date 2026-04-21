/**
 * Обход «HTML с кастомного домена ок, а /_next/static не грузится» (Safari, DNS, прокси у регистратора).
 * Задай в Vercel Production: NEXT_PUBLIC_ASSET_PREFIX=https://<project>.vercel.app (без слэша в конце) — чанки/CSS с технического домена.
 */
function normalizeAssetPrefix(raw) {
  if (raw == null || typeof raw !== "string") return undefined;
  const t = raw.trim().replace(/\/$/, "");
  if (!t) return undefined;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    return t;
  } catch {
    return undefined;
  }
}

const assetPrefix = normalizeAssetPrefix(process.env.NEXT_PUBLIC_ASSET_PREFIX);

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(assetPrefix ? { assetPrefix } : {}),
  /** Отключает глобальный `crossOrigin` в renderOpts (часть цепочки preinit остаётся у React). */
  crossOrigin: false,
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cross-Origin-Resource-Policy", value: "cross-origin" }]
      }
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**"
      }
    ]
  }
};

export default nextConfig;
