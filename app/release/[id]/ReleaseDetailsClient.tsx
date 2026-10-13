"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { ReleaseSleeve } from "@/components/ReleaseSleeve";
import { cn } from "@/lib/utils";
import { parseCollaboratorsFromDb } from "@/lib/collaborators";
import { debugInit } from "@/lib/debug";
import { openSmartLink } from "@/lib/open-smart-link";
import { PERFORMANCE_LANGUAGE_LABELS, parsePerformanceLanguage } from "@/lib/performance-language";
import { normalizeReleaseStatus } from "@/lib/release-status";
import { shouldShowSmartLinkCta } from "@/lib/smart-link-cta";
import { markStatusSeen } from "@/lib/seen-release-status";
import { isAdminUi } from "@/lib/admin";
import { USER_REQUEST_TIMEOUT_MESSAGE } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { getTelegramUserId, initTelegramWebApp } from "@/lib/telegram";
import { getReleaseDisplayTitle } from "@/repositories/releases/types";

type ReleaseDetailsTrackRow = {
  title: string;
  explicit: boolean;
  duration: number | null;
  index: number;
};

type ReleaseDetailsRow = {
  id: string;
  user_id: number | string;
  artist_name: string;
  track_name: string;
  title?: string | null;
  artwork_url: string | null;
  audio_url: string | null;
  release_type: string;
  genre: string;
  sub_genre?: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  smart_link: string | null;
  release_date?: string | null;
  explicit?: boolean | null;
  is_explicit?: boolean | null;
  performance_language?: string | null;
  isrc?: string | null;
  upc?: string | null;
  collaborators?: unknown;
  music_author?: string | null;
  tracks: ReleaseDetailsTrackRow[];
};

function formatReleaseTypeLabel(type: string | null | undefined): string {
  const t = (type ?? "").toLowerCase();
  if (t === "single") return "Сингл";
  if (t === "ep") return "EP";
  if (t === "album") return "Альбом";
  const s = (type ?? "").trim();
  return s.length > 0 ? s.toUpperCase() : "—";
}

function formatReleaseDateRu(d: string | null | undefined): string | null {
  if (d == null) return null;
  const raw = String(d).trim();
  if (!raw) return null;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed
    .toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    .replace(/\s*г\.?$/, "");
}

function formatTrackDurationSec(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(Number(sec))) return null;
  const n = Math.floor(Number(sec));
  const s = n % 60;
  const m = Math.floor(n / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatFeaturingProducers(collaboratorsRaw: unknown): string | null {
  const list = parseCollaboratorsFromDb(collaboratorsRaw);
  const parts: string[] = [];
  for (const c of list) {
    const name = c.name.trim();
    if (!name) continue;
    if (c.role === "featuring") parts.push(`${name} (фит)`);
    else if (c.role === "producer") parts.push(`${name} (продюсер)`);
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

const RELEASE_DETAILS_TIMEOUT_MS = 12000;

export default function ReleaseDetailsClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [webUserId, setWebUserId] = useState<string | null>(null);
  const [identityResolved, setIdentityResolved] = useState(false);
  const [release, setRelease] = useState<ReleaseDetailsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    debugInit("release/details", "init start");
    initTelegramWebApp();
    setUserId(getTelegramUserId());
    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setWebUserId(session?.user?.id ?? null);
      })
      .finally(() => {
        setIdentityResolved(true);
      });
    debugInit("release/details", "init done");
  }, []);

  useEffect(() => {
    if (!params.id) return;
    if (!identityResolved) return;
    const isAdminView = isAdminUi();
    const hasIdentity = isAdminView || userId != null || webUserId != null;
    if (!hasIdentity && process.env.NODE_ENV === "production") {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    const load = async () => {
      setLoading(true);
      setError(null);
      const startedAt = Date.now();
      debugInit("release/details", "load start", { releaseId: params.id, userId, webUserId });
      try {
        const base = supabase
          .from("releases")
          .select(
            "id, user_id, artist_name, track_name, title, artwork_url, audio_url, release_type, genre, sub_genre, status, error_message, created_at, smart_link, release_date, explicit, is_explicit, performance_language, isrc, upc, collaborators, music_author"
          )
          .eq("id", params.id);
        const filtered = isAdminView
          ? base
          : webUserId
            ? base.eq("user_uuid", webUserId)
            : base.or(`user_id.eq.${String(userId!)},telegram_id.eq.${String(userId!)}`);
        const queryPromise = Promise.resolve(filtered.maybeSingle());
        queryPromise.catch(() => {});
        const timeoutPromise = new Promise<Awaited<typeof queryPromise>>((_, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(new Error(USER_REQUEST_TIMEOUT_MESSAGE));
          }, RELEASE_DETAILS_TIMEOUT_MS);
        });

        const { data, error: dbError } = await Promise.race([
          queryPromise,
          timeoutPromise
        ]);
        if (timeoutId != null) {
          window.clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (dbError) throw dbError;
        if (!cancelled) {
          if (!data) {
            setRelease(null);
          } else {
            const { data: trackRows } = await supabase
              .from("tracks")
              .select("title, explicit, duration, index")
              .eq("release_id", params.id)
              .order("index", { ascending: true });
            const tracks: ReleaseDetailsTrackRow[] = (trackRows ?? []).map((row) => ({
              title: typeof row.title === "string" ? row.title : "",
              explicit: Boolean(row.explicit),
              duration: row.duration ?? null,
              index: row.index ?? 0
            }));
            setRelease({ ...(data as Omit<ReleaseDetailsRow, "tracks">), tracks });
          }
        }
        debugInit("release/details", "load success", {
          releaseId: params.id,
          hasData: Boolean(data),
          durationMs: Date.now() - startedAt
        });
      } catch (e: unknown) {
        if (timeoutId != null) {
          window.clearTimeout(timeoutId);
          timeoutId = null;
        }
        console.error("[release/details] load failed", e);
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Не удалось загрузить релиз.");
        }
      } finally {
        if (!cancelled) setLoading(false);
        debugInit("release/details", "load finished", {
          releaseId: params.id,
          durationMs: Date.now() - startedAt
        });
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [params.id, userId, webUserId, identityResolved]);

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto w-full max-w-lg px-1 pb-40 pt-4 text-omf-ink">{children}</div>
  );

  const backButton = (
    <button
      type="button"
      onClick={() => router.back()}
      className="omf-focus -ml-2 mb-4 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[14px] text-omf-graphite transition-colors hover:text-omf-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Релизы
    </button>
  );

  useEffect(() => {
    if (!release) return;
    const st = normalizeReleaseStatus(release.status);
    if (st === "ready" || st === "failed") markStatusSeen(release.id, st);
  }, [release]);

  if (!identityResolved || loading) {
    return shell(
      <div aria-busy="true">
        {backButton}
        <div className="mx-auto aspect-square w-[72%] max-w-[300px] animate-pulse rounded-sleeve bg-omf-surface" />
        <div className="mx-auto mt-6 h-7 w-1/2 animate-pulse rounded bg-omf-surface" />
        <div className="mx-auto mt-2 h-4 w-1/3 animate-pulse rounded bg-omf-surface" />
      </div>
    );
  }

  if (userId == null && webUserId == null && process.env.NODE_ENV === "production") {
    return shell(
      <>
        <h1 className="text-[24px] font-extrabold tracking-[-0.03em]">Нужен вход</h1>
        <p className="mt-2 text-[15px] text-omf-graphite">
          Открой приложение из Telegram или войди в веб-кабинет, чтобы увидеть релиз.
        </p>
      </>
    );
  }

  if (error) {
    return shell(
      <>
        {backButton}
        <h1 className="text-[24px] font-extrabold tracking-[-0.03em]">Не удалось открыть релиз</h1>
        <p className="mt-2 text-[15px] text-omf-graphite">{error}</p>
      </>
    );
  }

  if (!release) {
    return shell(
      <>
        {backButton}
        <h1 className="text-[24px] font-extrabold tracking-[-0.03em]">Релиз не найден</h1>
        <p className="mt-2 text-[15px] text-omf-graphite">
          Возможно, его удалили или ссылка открыта с другого аккаунта.
        </p>
      </>
    );
  }

  const canonical = normalizeReleaseStatus(release.status);
  const displayTitle = getReleaseDisplayTitle(release);
  const genreLine = [release.genre?.trim(), release.sub_genre?.trim()].filter(Boolean).join(", ");
  const releaseDateLabel = formatReleaseDateRu(release.release_date ?? null);
  const langLabel = PERFORMANCE_LANGUAGE_LABELS[parsePerformanceLanguage(release.performance_language)];
  const isExplicit = Boolean(release.explicit ?? release.is_explicit);
  const featuringLine = formatFeaturingProducers(release.collaborators);
  const sortedTracks = [...release.tracks].sort((a, b) => a.index - b.index);
  const smartLink =
    shouldShowSmartLinkCta(release.status, release.smart_link) && release.smart_link?.trim()
      ? release.smart_link.trim()
      : null;

  const passportRows: { label: string; value: string }[] = [
    { label: "Формат", value: formatReleaseTypeLabel(release.release_type) }
  ];
  if (genreLine.length > 0) passportRows.push({ label: "Жанр", value: genreLine });
  if (releaseDateLabel) passportRows.push({ label: "Дата выхода", value: releaseDateLabel });
  passportRows.push({ label: "Язык", value: langLabel });
  passportRows.push({ label: "Мат в тексте", value: isExplicit ? "Есть" : "Нет" });
  const musicAuthor = release.music_author?.trim();
  if (musicAuthor) passportRows.push({ label: "Автор бита", value: musicAuthor });
  if (featuringLine) passportRows.push({ label: "Участники", value: featuringLine });
  const isrc = release.isrc?.trim();
  if (isrc) passportRows.push({ label: "ISRC", value: isrc });
  const upc = release.upc?.trim();
  if (upc) passportRows.push({ label: "UPC", value: upc });

  const statusCopy: Record<typeof canonical, { title: string; body: string }> = {
    draft: {
      title: "Черновик",
      body: "Релиз ещё не отправлен. Открой его из списка релизов и закончи заполнение."
    },
    pending: {
      title: "Не отправлен",
      body: "Файлы загружены, но релиз ещё не ушёл на модерацию. Открой черновик и нажми «Отправить на проверку»."
    },
    processing: {
      title: "На проверке",
      body: "Модератор проверяет паспорт, обложку и аудио. Обычно это занимает до 24 часов. Когда решение будет принято, статус обновится здесь и мы напишем в Telegram."
    },
    ready: {
      title: "Одобрен",
      body: smartLink
        ? "Релиз прошёл модерацию и отправлен на площадки. Ссылка на все площадки — ниже."
        : "Релиз прошёл модерацию и отправлен на площадки. Ссылка появится, когда площадки опубликуют релиз."
    },
    failed: {
      title: "Отклонён",
      body:
        release.error_message?.trim() ||
        "Модератор не указал причину. Напиши в поддержку, чтобы узнать, что исправить."
    },
    unknown: {
      title: "Статус уточняется",
      body: "Не получилось определить статус релиза. Обнови страницу чуть позже."
    }
  };
  const status = statusCopy[canonical];

  return shell(
    <>
      {backButton}

      <div className="mx-auto w-[72%] max-w-[300px]">
        <ReleaseSleeve
          seed={release.id}
          title={displayTitle}
          artist={release.artist_name}
          coverUrl={release.artwork_url}
          status={canonical}
          size="hero"
          priority
        />
      </div>

      <h1 className="mt-7 break-words text-center text-[32px] font-extrabold leading-[0.95] tracking-[-0.04em]">
        {displayTitle}
      </h1>
      <p className="mt-2 text-center text-[15px] text-omf-graphite">{release.artist_name}</p>

      <section
        aria-labelledby="release-status-title"
        className={cn(
          "mt-8 rounded-control border p-4",
          canonical === "failed" ? "border-omf-red" : "border-omf-line"
        )}
      >
        <h2 id="release-status-title" className="text-[16px] font-bold tracking-tight">
          {status.title}
        </h2>
        <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-omf-graphite">{status.body}</p>
        {smartLink ? (
          <button
            type="button"
            onClick={() => openSmartLink(smartLink)}
            className="omf-btn-primary mt-4 w-full"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Открыть ссылку на релиз
          </button>
        ) : null}
      </section>

      {sortedTracks.length > 0 ? (
        <section aria-labelledby="release-tracks-title" className="mt-8">
          <h2 id="release-tracks-title" className="text-[13px] text-omf-graphite">
            {sortedTracks.length > 1 ? `Треки, ${sortedTracks.length}` : "Трек"}
          </h2>
          <ol className="mt-1">
            {sortedTracks.map((t, i) => {
              const dur = formatTrackDurationSec(t.duration);
              const name = t.title.trim() || "Без названия";
              return (
                <li
                  key={`${t.index}-${i}`}
                  className="flex items-baseline gap-3 border-b border-omf-line py-3 text-[15px]"
                >
                  {sortedTracks.length > 1 ? (
                    <span className="w-5 shrink-0 tabular-nums text-omf-faint">{i + 1}</span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  {t.explicit ? (
                    <span
                      className="shrink-0 rounded-[4px] bg-omf-surface-2 px-1.5 py-0.5 text-[11px] font-bold text-omf-graphite"
                      title="Есть мат"
                    >
                      E
                    </span>
                  ) : null}
                  {dur ? <span className="shrink-0 tabular-nums text-omf-graphite">{dur}</span> : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <section aria-labelledby="release-passport-title" className="mt-8">
        <h2 id="release-passport-title" className="text-[13px] text-omf-graphite">
          Паспорт релиза
        </h2>
        <dl className="mt-1">
          {passportRows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4 border-b border-omf-line py-3"
            >
              <dt className="shrink-0 text-[14px] text-omf-graphite">{row.label}</dt>
              <dd className="min-w-0 break-words text-right text-[15px]">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {release.audio_url ? (
        <a
          href={release.audio_url}
          target="_blank"
          rel="noreferrer"
          className="omf-btn-secondary mt-6 w-full"
        >
          <Download className="h-4 w-4" aria-hidden />
          Скачать аудио
        </a>
      ) : null}
    </>
  );
}
