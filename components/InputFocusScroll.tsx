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
 * TMA / мобильный WebView: после фокуса подкручиваем поле с учётом visualViewport
 * (клавиатура приходит с задержкой — повтор через ~320ms).
 * `nearest` меньше ломает длинные формы, чем `center`, когда снизу важна кнопка «Далее».
 */
export function InputFocusScroll() {
  useEffect(() => {
    const onFocusIn = (e: Event) => {
      if (!isTextField(e.target)) return;
      const el = e.target;

      const run = (behavior: ScrollBehavior) => {
        el.scrollIntoView({ behavior, block: "nearest", inline: "nearest" });
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(() => run("smooth"));
      });
      window.setTimeout(() => run("auto"), 320);
    };

    document.addEventListener("focusin", onFocusIn, true);
    return () => document.removeEventListener("focusin", onFocusIn, true);
  }, []);

  return null;
}
