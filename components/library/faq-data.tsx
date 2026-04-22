import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
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
  Users,
} from "lucide-react";

export type FaqTopicKey =
  | "audio"
  | "cover"
  | "release-date"
  | "release-type"
  | "collab"
  | "metadata"
  | "moderation"
  | "wav-warning"
  | "where-to-open";

export type FaqItem = {
  id: FaqTopicKey;
  title: string;
  icon: LucideIcon;
  iconClassName: string;
  searchText: string;
  tooltipText: string;
  tone?: "default" | "warning" | "gradient";
  content: ReactNode;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "audio",
    title: "Аудио",
    icon: FileAudio,
    iconClassName: "text-indigo-400",
    searchText: "wav формат pcm 16 24 float 32 stereo 44.1 48 khz 200 мб mp3 flac",
    tooltipText: "Загружайте только WAV (44.1/48 kHz), до 200 МБ на файл.",
    content: (
      <ul className="space-y-2.5 text-[13px] leading-snug text-white/70">
        <li>
          <span className="font-medium text-white/85">Формат:</span> только{" "}
          <span className="text-white/80">WAV</span> (PCM 16/24 bit или float 32 bit), стерео.
        </li>
        <li>
          <span className="font-medium text-white/85">Частота:</span>{" "}
          <span className="text-white/80">44.1 kHz</span> или <span className="text-white/80">48 kHz</span>{" "}
          — другие значения загрузчик не примет.
        </li>
        <li>
          <span className="font-medium text-white/85">Размер одного файла:</span> до{" "}
          <span className="text-white/80">200 МБ</span>.
        </li>
        <li className="text-white/55">
          MP3, FLAC и другие форматы для этой загрузки не подходят — экспортируйте WAV из DAW.
        </li>
      </ul>
    ),
  },
  {
    id: "cover",
    title: "Обложка",
    icon: ImageIcon,
    iconClassName: "text-fuchsia-400",
    searchText: "обложка jpeg png 3000x3000 35 мб квадрат",
    tooltipText: "Обложка: JPEG/PNG, квадрат от 3000×3000, до 35 МБ.",
    content: (
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
    ),
  },
  {
    id: "release-date",
    title: "Дата выхода в кабинете",
    icon: CalendarClock,
    iconClassName: "text-amber-300/90",
    searchText: "дата релиза не раньше 5 дней модерация доставка",
    tooltipText: "Выбирайте дату релиза минимум за 5 дней от текущей.",
    content: (
      <p className="text-[13px] leading-relaxed text-white/70">
        В мастере можно выбрать дату релиза{" "}
        <span className="font-medium text-white/85">не раньше чем через 5 дней от сегодняшней</span>{" "}
        (по календарю кабинета). Это нужно, чтобы успеть модерацию и доставку на площадки.
      </p>
    ),
  },
  {
    id: "release-type",
    title: "Тип релиза и треки",
    icon: ListMusic,
    iconClassName: "text-emerald-400",
    searchText: "сингл ep альбом количество треков",
    tooltipText: "Сингл = 1 трек, EP/альбом = от 2 треков.",
    content: (
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
          Названия в паспорте релиза и названия треков должны совпадать с тем, что вы хотите видеть в
          сторах; перед отправкой перечитайте шаг «Проверка».
        </li>
      </ul>
    ),
  },
  {
    id: "collab",
    title: "Фит и совместный трек",
    icon: Users,
    iconClassName: "text-sky-400",
    searchText: "фит совместный трек дополнительные артисты",
    tooltipText: "Добавляйте фиты через блок «Дополнительные артисты» на шаге «Треки».",
    content: (
      <p className="text-[13px] leading-relaxed text-white/70">
        На шаге <span className="font-medium text-white/85">«Треки»</span> есть блок{" "}
        <span className="font-medium text-white/85">«Дополнительные артисты»</span>: нажмите
        «Добавить артиста» и введите имя фита или другого участника — данные сохраняются в метаданных
        релиза. При необходимости уточните отображаемое название трека в поле названия (как в сторе).
      </p>
    ),
  },
  {
    id: "metadata",
    title: "Метаданные и маркировки",
    icon: Mic2,
    iconClassName: "text-violet-400",
    searchText: "язык explicit 18+ названия спецсимволы track 1",
    tooltipText: "Укажите язык и explicit-маркировку, избегайте служебных названий.",
    content: (
      <ul className="space-y-2.5 text-[13px] leading-snug text-white/70">
        <li>
          <span className="font-medium text-white/85">Язык исполнения</span> обязателен (список в
          мастере).
        </li>
        <li>
          <span className="font-medium text-white/85">Explicit (18+)</span> — отметьте на релизе и при
          необходимости на отдельных треках, если в тексте или подаче есть контент для взрослой
          маркировки.
        </li>
        <li className="text-white/55">
          В названиях избегайте лишних спецсимволов ($, @), длинных отрывков КАПСОМ и служебных фраз
          вроде «Track 1» — иначе кабинет или модерация могут запросить правки.
        </li>
      </ul>
    ),
  },
  {
    id: "moderation",
    title: "Модерация и статусы",
    icon: ShieldCheck,
    iconClassName: "text-teal-400",
    searchText: "черновик ожидает на проверке готов отклонен статус",
    tooltipText: "Проверьте статусы: черновик, проверка, готово или отклонено.",
    content: (
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
            <span className="font-medium text-white/85">На проверке</span> — релиз у модераторов; срок
            зависит от очереди (часто от нескольких часов до нескольких рабочих дней).
          </span>
        </li>
        <li className="flex gap-2">
          <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
          <span>
            <span className="font-medium text-white/85">Готов</span> — одобрен; smart link и дальнейшие
            шаги появятся в карточке релиза, когда их добавит команда.
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
    ),
  },
  {
    id: "wav-warning",
    title: "Важно про WAV после паузы",
    icon: AlertTriangle,
    iconClassName: "text-amber-200",
    searchText: "wav пауза закрыли приложение повторно прикрепить отправка",
    tooltipText: "После долгой паузы снова прикрепите WAV перед отправкой.",
    tone: "warning",
    content: (
      <p className="text-[13px] leading-relaxed text-white/70">
        Если вы закрыли приложение или долго не были в мастере, перед отправкой на модерацию снова
        прикрепите WAV на шаге «Треки» в этой сессии — иначе отправка может быть недоступна, даже если
        файлы уже были в базе.
      </p>
    ),
  },
  {
    id: "where-to-open",
    title: "Где что открыть",
    icon: ChevronRight,
    iconClassName: "text-indigo-300",
    searchText: "библиотека мультиссылки настройки где открыть",
    tooltipText: "Быстрые ссылки: Библиотека, Мультиссылки и Настройки.",
    tone: "gradient",
    content: (
      <ul className="space-y-2.5 text-[13px] text-white/65">
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
    ),
  },
];

export const FAQ_TOOLTIP_TEXT_BY_TOPIC: Record<FaqTopicKey, string> = FAQ_ITEMS.reduce(
  (acc, item) => {
    acc[item.id] = item.tooltipText;
    return acc;
  },
  {} as Record<FaqTopicKey, string>,
);
