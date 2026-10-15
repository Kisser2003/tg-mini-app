"use client";

import type { LucideIcon } from "lucide-react";
import { AppOrb } from "@/components/AppOrb";

type Props = {
  icon: LucideIcon;
  /** Идёт обновление списка: вместо иконки показываем орб. */
  spinning: boolean;
};

export function RefreshIcon({ icon: Icon, spinning }: Props) {
  if (spinning) return <AppOrb state="searching" size={20} label="Обновляем" />;
  return <Icon className="h-[18px] w-[18px]" aria-hidden />;
}
