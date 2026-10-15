"use client";

import { ThinkingOrb } from "thinking-orbs";

type OrbState = "working" | "searching" | "listening" | "connecting" | "weaving" | "composing" | "breathing";

type Props = {
  state: OrbState;
  /** 64 — экранные лоадеры, 20 — рядом с текстом и в кнопках. */
  size?: 64 | 20;
  label?: string;
  className?: string;
};

/**
 * Единая точка использования `thinking-orbs`. Тема подхватывается сама (`html.dark`),
 * для `prefers-reduced-motion` пакет рисует статичный кадр.
 */
export function AppOrb({ state, size = 64, label, className }: Props) {
  return (
    <ThinkingOrb
      state={state}
      size={size}
      aria-label={label}
      className={["shrink-0", className].filter(Boolean).join(" ")}
    />
  );
}
