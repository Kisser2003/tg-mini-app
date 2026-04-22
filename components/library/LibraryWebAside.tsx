"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  CircleDot,
  FileAudio,
  ImageIcon,
  ListMusic,
  Mic2,
  ShieldCheck,
  Users
} from "lucide-react";

/**
 * Контент страницы FAQ (/requirements): фактические правила OMF, а не общие шаблоны.
 */
export function LibraryWebAside() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-md">
        <div className="mb-4 flex items-center gap-2 text-white/90">
          <FileAudio className="h-4 w-4 shrink-0 text-indigo-400" />
          <h2 className="text-sm font-semibold tracking-tight">Аудио</h2>
        </div>
        <ul className="space-y-2.5 text-[13px] leading-snug text-white/70">
          <li>
            <span className="font-medium text-white/85">Формат:</span> только{" "}
            <span className="text-white/80">WAV</span> (PCM 16/24 bit или float 32 bit), стерео.
          </li>
          <li>
            <span className="font-medium text-white/85">Частота:</span>{" "}
            <span className="text-white/80">44.1 kHz</span> или{" "}
            <span className="text-white/80">48 kHz</span> — другие значения загрузчик не примет.
          </li>
          <li>
            <span className="font-medium text-white/85">Размер одного файла:</span> до{" "}
            <span className="text-white/80">200 МБ</span>.
          </li>
          <li className="text-white/55">
            MP3, FLAC и другие форматы для этой загрузки не подходят — экспортируйте WAV из DAW.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-md">
        <div className="mb-4 flex items-center gap-2 text-white/90">
          <ImageIcon className="h-4 w-4 shrink-0 text-fuchsia-400" />
          <h2 className="text-sm font-semibold tracking-tight">Обложка</h2>
        </div>
        <ul className="space-y-2.5 text-[13px] leading-snug text-white/70">
          <li>
            <span className="font-medium text-white/85">Формат:</span> JPEG или PNG.
          </li>
          <li>
            <span className="font-medium text-white/85">Размер:</span> квадрат, минимум{" "}
            <span className="text-white/80">3000×3000 px</span>; для сторов лучше сразу 3000×3000.
          </li>
          <li>
            <span className="font-medium text-white/85">Вес файла:</span> до{" "}
            <span className="text-white/80">35 МБ</span>.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-md">
        <div className="mb-4 flex items-center gap-2 text-white/90">
          <CalendarClock className="h-4 w-4 shrink-0 text-amber-300/90" />
          <h2 className="text-sm font-semibold tracking-tight">Дата выхода в кабинете</h2>
        </div>
        <p className="text-[13px] leading-relaxed text-white/70">
          В мастере можно выбрать дату релиза{" "}
          <span className="font-medium text-white/85">не раньше чем через 5 дней от сегодняшней</span>{" "}
          (по календарю кабинета). Это нужно, чтобы успеть модерацию и доставку на площадки.
        </p>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-md">
        <div className="mb-4 flex items-center gap-2 text-white/90">
          <ListMusic className="h-4 w-4 shrink-0 text-emerald-400" />
          <h2 className="text-sm font-semibold tracking-tight">Тип релиза и треки</h2>
        </div>
        <ul className="space-y-2.5 text-[13px] leading-snug text-white/70">
          <li>
            <span className="font-medium text-white/85">Сингл</span> — ровно{" "}
            <span className="text-white/80">один</span> трек и один WAV.
          </li>
          <li>
            <span className="font-medium text-white/85">EP или альбом</span> — минимум{" "}
            <span className="text-white/80">два</span> трека, у каждого свой WAV.
          </li>
          <li>
            Названия в паспорте релиза и названия треков должны совпадать с тем, что вы хотите видеть
            в сторах; перед отправкой перечитайте шаг «Проверка».
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-md">
        <div className="mb-4 flex items-center gap-2 text-white/90">
          <Users className="h-4 w-4 shrink-0 text-sky-400" />
          <h2 className="text-sm font-semibold tracking-tight">Фит и совместный трек</h2>
        </div>
        <p className="text-[13px] leading-relaxed text-white/70">
          На шаге <span className="font-medium text-white/85">«Треки»</span> есть блок{" "}
          <span className="font-medium text-white/85">«Дополнительные артисты»</span>: нажмите
          «Добавить артиста» и введите имя фита или другого участника — данные сохраняются в
          метаданных релиза. При необходимости уточните отображаемое название трека в поле названия
          (как в сторе).
        </p>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-md">
        <div className="mb-4 flex items-center gap-2 text-white/90">
          <Mic2 className="h-4 w-4 shrink-0 text-violet-400" />
          <h2 className="text-sm font-semibold tracking-tight">Метаданные и маркировки</h2>
        </div>
        <ul className="space-y-2.5 text-[13px] leading-snug text-white/70">
          <li>
            <span className="font-medium text-white/85">Язык исполнения</span> обязателен (список в
            мастере).
          </li>
          <li>
            <span className="font-medium text-white/85">Explicit (18+)</span> — отметьте на релизе и
            при необходимости на отдельных треках, если в тексте или подаче есть контент для
            взрослой маркировки.
          </li>
          <li className="text-white/55">
            В названиях избегайте лишних спецсимволов ($, @), длинных отрывков КАПСОМ и служебных
            фраз вроде «Track 1» — иначе кабинет или модерация могут запросить правки.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-md">
        <div className="mb-4 flex items-center gap-2 text-white/90">
          <ShieldCheck className="h-4 w-4 shrink-0 text-teal-400" />
          <h2 className="text-sm font-semibold tracking-tight">Модерация и статусы</h2>
        </div>
        <ul className="space-y-2.5 text-[13px] leading-snug text-white/70">
          <li className="flex gap-2">
            <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/35" />
            <span>
              <span className="font-medium text-white/85">Черновик / ожидает</span> — можно править и
              загружать файлы.
            </span>
          </li>
          <li className="flex gap-2">
            <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/80" />
            <span>
              <span className="font-medium text-white/85">На проверке</span> — релиз у модераторов;
              срок зависит от очереди (часто от нескольких часов до нескольких рабочих дней).
            </span>
          </li>
          <li className="flex gap-2">
            <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
            <span>
              <span className="font-medium text-white/85">Готов</span> — одобрен; smart link и
              дальнейшие шаги появятся в карточке релиза, когда их добавит команда.
            </span>
          </li>
          <li className="flex gap-2">
            <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400/80" />
            <span>
              <span className="font-medium text-white/85">Отклонён</span> — в карточке будет причина;
              правки можно внести и отправить снова из библиотеки.
            </span>
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5 backdrop-blur-md">
        <div className="mb-3 flex items-center gap-2 text-amber-100/95">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <h2 className="text-sm font-semibold tracking-tight">Важно про WAV после паузы</h2>
        </div>
        <p className="text-[13px] leading-relaxed text-white/70">
          Если вы закрыли приложение или долго не были в мастере, перед отправкой на модерацию снова
          прикрепите WAV на шаге «Треки» в этой сессии — иначе отправка может быть недоступна, даже
          если файлы уже были в базе.
        </p>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-indigo-500/10 to-purple-600/5 p-5 backdrop-blur-md">
        <h2 className="text-sm font-semibold text-white/90">Где что открыть</h2>
        <ul className="mt-3 space-y-2.5 text-[13px] text-white/65">
          <li>
            <Link
              href="/library"
              className="inline-flex items-center gap-1 font-medium text-indigo-300 hover:text-indigo-200"
            >
              Библиотека релизов
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>{" "}
            — черновики, очередь, готовые.
          </li>
          <li>
            <Link
              href="/multi-links"
              className="inline-flex items-center gap-1 font-medium text-indigo-300 hover:text-indigo-200"
            >
              Мультиссылки
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>{" "}
            — после выпуска, когда ссылки выдаст модерация.
          </li>
          <li>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 font-medium text-indigo-300 hover:text-indigo-200"
            >
              Настройки аккаунта
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </li>
        </ul>
      </section>

      <p className="px-1 text-[11px] leading-relaxed text-white/35">
        Требования стриминговых сервисов иногда меняются. Если кейс нестандартный (сборник, кавер,
        сложное оформление прав) — уточните у поддержки OMF до финальной отправки.
      </p>
    </div>
  );
}
