"use client";

import { useEffect } from "react";
import { ImageGeneration } from "img-fx";

const MOSAIC_MS = 2600;

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
      revealDelayRange={[0.3, 0.5]}
      revealHoldMs={250}
    >
      <div className="h-full w-full rounded-sleeve" />
    </ImageGeneration>
  );
}
