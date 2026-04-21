"use client";

import Link from "next/link";
import { Check, ChevronRight, HelpCircle, Music2 } from "lucide-react";

const CHECKLIST = [
  {
    title: "Аудио",
    detail: "WAV, 44.1 kHz или 48 kHz, 16 или 24 bit, стерео."
  },
  {
    title: "Обложка",
    detail: "JPEG или PNG, квадрат от 3000×3000 px (рекомендуется 3000×3000)."
  },
  {
    title: "Метаданные",
    detail: "Корректные название релиза, жанр, дата выхода, явная маркировка explicit при необходимости."
  }
] as const;

const FAQ = [
  {
    q: "Сколько длится модерация?",
    a: "Обычно от нескольких часов до 2–3 рабочих дней — зависит от загрузки и полноты данных."
  },
  {
    q: "Можно ли править релиз после отправки?",
    a: "Черновики и отклонённые релизы можно доработать из библиотеки; у отгруженных на DSP изменения идут отдельным процессом."
  }
] as const;

/**
 * Правая колонка на широком экране (веб): чек-лист, краткий FAQ, полезные ссылки.
 */
export function LibraryWebAside() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-md">
        <div className="mb-4 flex items-center gap-2 text-white/90">
          <Music2 className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-semibold tracking-tight">Требования к релизу</h2>
        </div>
        <ul className="space-y-3">
          {CHECKLIST.map((item) => (
            <li key={item.title} className="flex gap-3 text-[13px] leading-snug text-white/70">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-300">
                <Check className="h-3 w-3" strokeWidth={2.5} />
              </span>
              <span>
                <span className="font-medium text-white/85">{item.title}.</span> {item.detail}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-md">
        <div className="mb-3 flex items-center gap-2 text-white/90">
          <HelpCircle className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-semibold tracking-tight">Коротко</h2>
        </div>
        <ul className="space-y-4">
          {FAQ.map((item) => (
            <li key={item.q}>
              <p className="text-[12px] font-medium text-white/80">{item.q}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-white/45">{item.a}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-indigo-500/10 to-purple-600/5 p-5 backdrop-blur-md">
        <h2 className="text-sm font-semibold text-white/90">Полезно перед отправкой</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-white/45">
          Проверьте соответствие названий в паспорте и названий загруженных треков, а также корректность
          даты релиза.
        </p>
        <Link
          href="/settings"
          className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-indigo-300 hover:text-indigo-200"
        >
          Открыть настройки
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      <p className="px-1 text-[11px] leading-relaxed text-white/25">
        Подробные правила загрузки и модерации уточняйте у поддержки — требования стримингов могут
        обновляться.
      </p>
    </div>
  );
}
