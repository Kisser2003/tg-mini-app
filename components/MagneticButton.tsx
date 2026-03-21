"use client";

import { type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { MagneticWrapper } from "@/components/MagneticWrapper";
import { SPRING_UI } from "@/lib/motion-spring";

type MagneticButtonProps = Omit<HTMLMotionProps<"button">, "whileTap" | "children"> & {
  children: ReactNode;
};

/**
 * Основная CTA: MagneticWrapper (0.15) + whileTap 0.92.
 */
export function MagneticButton({
  children,
  className = "",
  disabled = false,
  type = "button",
  ...rest
}: MagneticButtonProps) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={{ scale: 0.92 }}
      transition={SPRING_UI}
      className={className}
      {...rest}
    >
      <MagneticWrapper
        disabled={disabled}
        className="inline-flex w-full items-center justify-center"
        strength={0.15}
      >
        {children}
      </MagneticWrapper>
    </motion.button>
  );
}
