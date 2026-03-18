"use client";

import { motion } from "framer-motion";

export function LoadingScreen() {
  return (
    <div className="flex min-h-[65vh] items-center justify-center">
      <div className="relative">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.8, ease: "linear", repeat: Infinity }}
          className="h-28 w-28 rounded-full border border-white/20 bg-gradient-to-br from-white/20 via-white/5 to-white/10 shadow-[0_12px_45px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
        />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-8 w-8 rounded-full border border-white/20 bg-black/70" />
          <div className="absolute h-2 w-2 rounded-full bg-white/80" />
        </div>
      </div>
    </div>
  );
}
