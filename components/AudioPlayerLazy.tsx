"use client";

import dynamic from "next/dynamic";

/** Code-split audio player — не тянет плеер в основной бандл страниц списка. */
export const AudioPlayerLazy = dynamic(
  () => import("./AudioPlayer").then((m) => ({ default: m.AudioPlayer })),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-9 w-full animate-pulse rounded-lg bg-white/5"
        aria-hidden
      />
    )
  }
);
