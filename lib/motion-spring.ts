import type { Transition } from "framer-motion";

/** Физика spring (для `useSpring` и `transition`). */
export const SPRING_PHYSICS = { stiffness: 300, damping: 30 };

/** Единые spring-параметры для премиального UI (как в ТЗ). */
export const SPRING_UI: Transition = {
  type: "spring",
  ...SPRING_PHYSICS
};

/** Прогресс-бар с лёгким «выстрелом» вперёд (overshoot). */
export const SPRING_PROGRESS: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 22,
  mass: 0.85
};
