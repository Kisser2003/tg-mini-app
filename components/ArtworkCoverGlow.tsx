"use client";

import Image from "next/image";
import type { ReactNode } from "react";

const ARTWORK_SIZES = "(max-width: 768px) 100vw, 33vw";

type ArtworkCoverGlowProps = {
  artworkUrl: string | null | undefined;
  children: ReactNode;
  className?: string;
  /** Приоритет для LCP на первых карточках */
  priority?: boolean;
};

/**
 * Мягкое цветное «облако» за карточкой: размытая копия обложки (blur), без API-логики.
 */
export function ArtworkCoverGlow({
  artworkUrl,
  children,
  className = "",
  priority = false
}: ArtworkCoverGlowProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {artworkUrl ? (
        <div
          className="pointer-events-none absolute -inset-[28%] -z-10 overflow-hidden rounded-[inherit]"
          aria-hidden
        >
          <Image
            src={artworkUrl}
            alt=""
            fill
            sizes={ARTWORK_SIZES}
            priority={priority}
            className="scale-[1.55] object-cover opacity-[0.42] blur-[40px]"
          />
        </div>
      ) : null}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
