export type ReleaseStatus = "Live" | "Pending" | "Rejected";

export type ReleaseItem = {
  id: string;
  title: string;
  coverUrl: string;
  streams: string;
  status: ReleaseStatus;
};

export type StreamPoint = {
  label: string;
  value: number;
};

export type TrackDetails = {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  totalStreams: string;
  moderationStatus: ReleaseStatus;
  moderationNote: string;
  streamTrend: StreamPoint[];
};

export type PendingRelease = {
  id: string;
  title: string;
  artist: string;
  submittedAt: string;
  genre: string;
  coverUrl: string;
};

export const ADMIN_TELEGRAM_ID = 810176982;
export const mockCurrentUserId = 810176982;
export const isAdmin = mockCurrentUserId === ADMIN_TELEGRAM_ID;

export const artistProfile = {
  name: "OMF Collective",
  handle: "@omfmusic",
  avatarUrl: "https://images.unsplash.com/photo-1542204165-65bf26472b9b?auto=format&fit=crop&w=256&q=80"
};

export const dashboardStats = [
  { label: "Статистика", value: "2.47M", delta: "+12.4% за неделю" },
  { label: "Активные релизы", value: "18", delta: "+3 за месяц" },
  { label: "Баланс", value: "$14,820", delta: "Выплата в пятницу" }
];

export const releases: ReleaseItem[] = [
  {
    id: "r-1",
    title: "Midnight Orbit",
    coverUrl: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=80",
    streams: "842K",
    status: "Live"
  },
  {
    id: "r-2",
    title: "Neon Pulse",
    coverUrl: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=800&q=80",
    streams: "301K",
    status: "Pending"
  },
  {
    id: "r-3",
    title: "Echo Bloom",
    coverUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=800&q=80",
    streams: "57K",
    status: "Rejected"
  },
  {
    id: "r-4",
    title: "Skyline Reverie",
    coverUrl: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=800&q=80",
    streams: "1.2M",
    status: "Live"
  }
];

export const releaseDetails: Record<string, TrackDetails> = {
  "r-1": {
    id: "r-1",
    title: "Midnight Orbit",
    artist: "OMF Collective",
    coverUrl:
      "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=80",
    totalStreams: "842,910",
    moderationStatus: "Live",
    moderationNote: "Релиз доставлен на DSP-платформы и полностью проиндексирован.",
    streamTrend: [
      { label: "Пн", value: 22 },
      { label: "Вт", value: 36 },
      { label: "Ср", value: 41 },
      { label: "Чт", value: 33 },
      { label: "Пт", value: 58 },
      { label: "Сб", value: 64 },
      { label: "Вс", value: 49 }
    ]
  },
  "r-2": {
    id: "r-2",
    title: "Neon Pulse",
    artist: "OMF Collective",
    coverUrl:
      "https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=800&q=80",
    totalStreams: "301,204",
    moderationStatus: "Pending",
    moderationNote: "Идет проверка обложки. Ориентировочное время одобрения: 24 часа.",
    streamTrend: [
      { label: "Пн", value: 8 },
      { label: "Вт", value: 12 },
      { label: "Ср", value: 18 },
      { label: "Чт", value: 24 },
      { label: "Пт", value: 26 },
      { label: "Сб", value: 28 },
      { label: "Вс", value: 31 }
    ]
  },
  "r-3": {
    id: "r-3",
    title: "Echo Bloom",
    artist: "OMF Collective",
    coverUrl:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=800&q=80",
    totalStreams: "57,340",
    moderationStatus: "Rejected",
    moderationNote: "Обнаружено несоответствие метаданных между названием и тегами файла.",
    streamTrend: [
      { label: "Пн", value: 6 },
      { label: "Вт", value: 4 },
      { label: "Ср", value: 9 },
      { label: "Чт", value: 8 },
      { label: "Пт", value: 12 },
      { label: "Сб", value: 10 },
      { label: "Вс", value: 8 }
    ]
  },
  "r-4": {
    id: "r-4",
    title: "Skyline Reverie",
    artist: "OMF Collective",
    coverUrl:
      "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=800&q=80",
    totalStreams: "1,201,440",
    moderationStatus: "Live",
    moderationNote: "Все превью на витринах обновлены успешно.",
    streamTrend: [
      { label: "Пн", value: 44 },
      { label: "Вт", value: 49 },
      { label: "Ср", value: 54 },
      { label: "Чт", value: 61 },
      { label: "Пт", value: 69 },
      { label: "Сб", value: 72 },
      { label: "Вс", value: 65 }
    ]
  }
};

export const genres = [
  "Поп",
  "Хип-хоп",
  "Электроника",
  "R&B",
  "Инди",
  "Лоу-фай"
];

export const pendingReleases: PendingRelease[] = [
  {
    id: "p-1",
    title: "Blue Signals",
    artist: "Astra Nova",
    submittedAt: "18 Mar, 14:40",
    genre: "Электроника",
    coverUrl: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "p-2",
    title: "Afterglow",
    artist: "Lune",
    submittedAt: "18 Mar, 12:18",
    genre: "Поп",
    coverUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "p-3",
    title: "Static Hearts",
    artist: "Violet Rain",
    submittedAt: "18 Mar, 09:05",
    genre: "R&B",
    coverUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&q=80"
  }
];

export const systemLogs = [
  "[20:11:03] Сканер: проверка соотношения сторон обложки пройдена",
  "[20:11:11] Очередь: трек нормализован до -14 LUFS",
  "[20:11:18] Метаданные: зарезервирован ISRC для 2 релизов",
  "[20:11:25] Доставка: пакет для DSP подписан и зашифрован"
];

export const walletSummary = {
  availableBalance: "$14,820",
  pendingBalance: "$2,430",
  nextPayoutDate: "22 марта 2026"
};

export const payoutHistory = [
  { id: "pay-1", date: "12 марта 2026", amount: "$3,420", status: "Выполнено" },
  { id: "pay-2", date: "05 марта 2026", amount: "$2,980", status: "Выполнено" },
  { id: "pay-3", date: "26 февраля 2026", amount: "$1,740", status: "Выполнено" },
  { id: "pay-4", date: "18 февраля 2026", amount: "$2,110", status: "Выполнено" }
];
