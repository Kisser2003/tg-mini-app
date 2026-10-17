"use client";

import type { ReactNode } from "react";
import { AppOrb } from "@/components/AppOrb";

type Props = {
  busy: boolean;
  /** Текст рядом с орбом, пока идёт операция. */
  busyText: string;
  /** Обычная подпись кнопки. */
  children: ReactNode;
};

/**
 * Подпись кнопки с состоянием «в процессе»: орб и текст. Лежит внутри `.omf-btn-*`,
 * у которого уже есть inline-flex и gap, поэтому своей разметки не добавляет.
 */
export function BusyLabel({ busy, busyText, children }: Props) {
  if (!busy) return <>{children}</>;
  return (
    <>
      <AppOrb state="working" size={20} />
      {busyText}
    </>
  );
}
