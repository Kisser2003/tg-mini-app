"use client";

import { motion } from "framer-motion";
import { Bell, MoonStar, ShieldCheck } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

const items = [
  { label: "Темный интерфейс", icon: MoonStar, value: "Включен" },
  { label: "Push-уведомления", icon: Bell, value: "В реальном времени" },
  { label: "Безопасность дистрибуции", icon: ShieldCheck, value: "Защищено" }
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-4 pb-10">
      <GlassCard className="p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-white/55">Настройки</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Параметры приложения</h1>
      </GlassCard>

      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <motion.button
            key={item.label}
            type="button"
            whileHover={{ scale: 0.99 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, type: "spring", stiffness: 320, damping: 22 }}
            className="glass-card flex w-full items-center justify-between p-4 text-left"
          >
            <span className="inline-flex items-center gap-3">
              <Icon className="h-4 w-4 text-white/80" />
              <span className="text-sm">{item.label}</span>
            </span>
            <span className="text-xs text-white/60">{item.value}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
