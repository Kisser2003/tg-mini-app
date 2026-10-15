"use client";

import { ImageGeneration } from "img-fx";

type Props = {
  /** Уменьшенная копия обложки: в WebGL не отправляем исходник 3000×3000. */
  src: string;
};

/** Пиксельная мозаика поверх превью обложки: проявляет картинку, затем исчезает. */
export default function CoverMosaic({ src }: Props) {
  return (
    <ImageGeneration
      className="h-full w-full"
      preset="pixels-organic"
      theme="dark"
      cardBg="#22262f"
      images={[src]}
      autoReveal
      revealDelayRange={[0.3, 0.5]}
      revealHoldMs={250}
    >
      <div className="h-full w-full rounded-sleeve" />
    </ImageGeneration>
  );
}
