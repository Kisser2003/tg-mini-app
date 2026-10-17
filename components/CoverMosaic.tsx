"use client";

import { useEffect } from "react";
import { ImageGeneration } from "img-fx";

// Пиксельная фаза держится фиксированные 3 с, даже если обложка уже готова. Переход картинки ~2.6 с
// (pixDuration пресета) укладывается в эти 3 с, поэтому отсчёт не обрывает проявление.
const MOSAIC_MS = 3000;

type Props = {
  /** Уменьшенная копия обложки: в WebGL не отправляем исходник 3000×3000. */
  src: string;
  /** Вызывается, когда мозаика отыграла и её пора убрать. */
  onDone: () => void;
};

/** Пиксельная мозаика поверх превью обложки: проявляет картинку, затем исчезает. */
export default function CoverMosaic({ src, onDone }: Props) {
  useEffect(() => {
    // Отсчёт идёт с монтирования: до этого момента мозаики на экране ещё нет (чанк three.js грузится лениво).
    const t = setTimeout(onDone, MOSAIC_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <ImageGeneration
      className="h-full w-full"
      preset="pixels-organic"
      theme="dark"
      cardBg="#22262f"
      images={[src]}
      autoReveal
      revealDelayRange={[0.3, 0.3]}
      revealHoldMs={0}
    >
      <div className="h-full w-full rounded-sleeve" />
    </ImageGeneration>
  );
}
