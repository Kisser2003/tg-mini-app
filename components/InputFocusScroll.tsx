"use client";

import { useEffect } from "react";

function isTextField(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;
  const type = (el as HTMLInputElement).type;
  if (type === "hidden" || type === "checkbox" || type === "radio" || type === "button" || type === "submit" || type === "reset") {
    return false;
  }
  return true;
}

/**
 * TMA: при фокусе на поле ввода прокручивает его в центр видимой области
 * (после появления клавиатуры layout успевает обновиться).
 */
export function InputFocusScroll() {
  useEffect(() => {
    const onFocusIn = (e: Event) => {
      if (!isTextField(e.target)) return;
      const el = e.target;

      const run = () => {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(run);
      });
    };

    document.addEventListener("focusin", onFocusIn, true);
    return () => document.removeEventListener("focusin", onFocusIn, true);
  }, []);

  return null;
}
