import type { Transition } from "framer-motion";

/** Физика spring (для `useSpring` и `transition`). */
export const SPRING_PHYSICS = { stiffness: 300, damping: 30 };

/** Единые spring-параметры для премиального UI (как в ТЗ). */
export const SPRING_UI: Transition = {
  type: "spring",
  ...SPRING_PHYSICS,
  bounce: 0
};

/** Быстрый отклик UI без «пружины» на конце. */
export const SPRING_UI_SNAP: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 34,
  bounce: 0,
  mass: 0.85
};

/** Прогресс-бар с лёгким «выстрелом» вперёд (overshoot). */
export const SPRING_PROGRESS: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 22,
  mass: 0.85
};
