"use client";

import { useEffect, useRef } from "react";
import { getTelegramWebApp } from "@/lib/telegram";

export type UseTelegramMainButtonOptions = {
  /** Button label text */
  text: string;
  /** Called when the user taps the button */
  onClick: () => void;
  /** Visually disable the button (still shown) */
  disabled?: boolean;
  /** Show spinner inside the button */
  loading?: boolean;
  /** Set to false to hide the button entirely (default: true) */
  enabled?: boolean;
};

/**
 * Controls the Telegram WebApp native MainButton for the lifetime of the
 * calling component. Falls back gracefully when running outside Telegram.
 *
 * Show/hide, enable/disable, and loading state are all synced reactively.
 * The handler is registered once and replaced via a stable ref to avoid
 * multiple onClick registrations when `onClick` changes identity.
 */
export function useTelegramMainButton({
  text,
  onClick,
  disabled = false,
  loading = false,
  enabled = true
}: UseTelegramMainButtonOptions): void {
  const handlerRef = useRef(onClick);
  handlerRef.current = onClick;

  // Mount / unmount — register handler and show button
  useEffect(() => {
    const btn = getTelegramWebApp()?.MainButton;
    if (!btn) return;

    const handler = () => handlerRef.current();
    btn.setText(text);

    if (enabled) {
      btn.show();
    } else {
      btn.hide();
      return;
    }

    btn.onClick(handler);

    return () => {
      btn.offClick(handler);
      btn.hide();
      btn.hideProgress();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Sync text
  useEffect(() => {
    const btn = getTelegramWebApp()?.MainButton;
    if (!btn || !enabled) return;
    btn.setText(text);
  }, [text, enabled]);

  // Sync disabled state
  useEffect(() => {
    const btn = getTelegramWebApp()?.MainButton;
    if (!btn || !enabled) return;
    if (disabled) {
      btn.disable();
    } else {
      btn.enable();
    }
  }, [disabled, enabled]);

  // Sync loading state
  useEffect(() => {
    const btn = getTelegramWebApp()?.MainButton;
    if (!btn || !enabled) return;
    if (loading) {
      btn.showProgress(false);
      btn.disable();
    } else {
      btn.hideProgress();
      if (!disabled) btn.enable();
    }
  }, [loading, disabled, enabled]);
}
