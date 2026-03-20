"use client";

import { AnimatePresence, motion } from "framer-motion";

type Props = {
  message?: string | null;
  /** Доп. класс на внешний контейнер (например min-h для группы). */
  className?: string;
  /** Класс на текст ошибки (например text-center). */
  messageClassName?: string;
};

/**
 * Сообщение об ошибке с плавным раскрытием по высоте — без резкого сдвига соседей.
 */
export function FormFieldError({ message, className = "", messageClassName = "" }: Props) {
  const text = message?.trim();

  return (
    <div className={`relative ${className}`.trim()}>
      <AnimatePresence initial={false} mode="sync">
        {text ? (
          <motion.div
            key={text}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <p
              className={`break-words pt-1.5 text-[11px] leading-relaxed text-red-400 ${messageClassName}`.trim()}
            >
              {text}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
