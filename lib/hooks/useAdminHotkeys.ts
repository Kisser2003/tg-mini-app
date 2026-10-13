"use client";

import { useEffect, useRef } from "react";

export type AdminHotkeyAction = "approve" | "reject" | "next" | "prev";

/** Латиница и та же клавиша в русской раскладке. */
const KEY_TO_ACTION: Record<string, AdminHotkeyAction> = {
  a: "approve",
  ф: "approve",
  r: "reject",
  к: "reject",
  j: "next",
  о: "next",
  arrowright: "next",
  k: "prev",
  л: "prev",
  arrowleft: "prev"
};

export type HotkeyEventLike = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
  target?: { tagName?: string; isContentEditable?: boolean } | null;
};

/** Какое действие у нажатия; `null` — не наше (модификаторы, ввод текста, автоповтор). */
export function resolveAdminHotkey(e: HotkeyEventLike): AdminHotkeyAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.repeat) return null;
  const tag = e.target?.tagName?.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable) return null;
  return KEY_TO_ACTION[e.key.toLowerCase()] ?? null;
}

/**
 * Горячие клавиши экрана модерации (веб): A — принять, R — вернуть, J/→ — следующий, K/← — предыдущий.
 * `enabled = false`, пока открыто модальное окно или идёт запрос.
 */
export function useAdminHotkeys(
  handlers: Partial<Record<AdminHotkeyAction, () => void>>,
  enabled: boolean
): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const action = resolveAdminHotkey({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        repeat: event.repeat,
        target: event.target as HTMLElement | null
      });
      if (!action) return;
      const handler = ref.current[action];
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
