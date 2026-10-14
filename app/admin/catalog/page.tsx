"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import useSWR from "swr";
import { PullRefreshBrand } from "@/components/PullRefreshBrand";
import { ReleaseSleeve } from "@/components/ReleaseSleeve";
import { AdminModerationQueueSkeleton } from "@/components/ui/LibrarySkeleton";
import { fetchAdminCatalog } from "@/features/admin/catalog";
import { isAdminUi, isAdminUiByWebSession } from "@/lib/admin";
import {
  flattenCatalogTracks,
  groupCatalogByArtist,
  matchesCatalogTrack,
  summarizeCatalog,
  artistKey
} from "@/lib/admin-catalog";
import { formatAgoRu } from "@/lib/admin-release-metadata";
import { errorToUserString, USER_REQUEST_TIMEOUT_MESSAGE } from "@/lib/errors";
import { hapticMap } from "@/lib/haptic-map";
import { pluralRu } from "@/lib/release-next-step";
import { SWR_LIST_OPTIONS } from "@/lib/swr-config";
import { getTelegramUserId, initTelegramWebApp } from "@/lib/telegram";
import { cn } from "@/lib/utils";
import { withRequestTimeout } from "@/lib/withRequestTimeout";

type CatalogTab = "tracks" | "artists";

const CATALOG_TIMEOUT_MS = 20000;
const VISIBLE_CHUNK = 50;

const TYPE_LABEL = { single: "Сингл", ep: "EP", album: "Альбом" } as const;

function formatAcceptedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

/** Каталог: всё, что приняли и отгрузили на площадки, — треки, артисты, итоги. */
export default function AdminCatalogPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminResolved, setAdminResolved] = useState(false);
  const [tab, setTab] = useState<CatalogTab>("tracks");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(VISIBLE_CHUNK);

  useEffect(() => {
    initTelegramWebApp();
    setUserId(getTelegramUserId());
    setIsAdmin(isAdminUi());
    void (async () => {
      const webAdmin = await isAdminUiByWebSession();
      setIsAdmin((prev) => prev || webAdmin);
      setAdminResolved(true);
    })();
  }, []);

  useEffect(() => {
    if (adminResolved && !isAdmin) router.replace("/");
  }, [adminResolved, isAdmin, router]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    isAdmin ? (["admin-catalog"] as const) : null,
    () => withRequestTimeout(fetchAdminCatalog(), CATALOG_TIMEOUT_MS, USER_REQUEST_TIMEOUT_MESSAGE),
    { ...SWR_LIST_OPTIONS, keepPreviousData: true }
  );

  const releases = useMemo(() => data?.rows ?? [], [data?.rows]);
  const summary = useMemo(() => summarizeCatalog(releases), [releases]);
  const allTracks = useMemo(() => flattenCatalogTracks(releases), [releases]);
  const allArtists = useMemo(() => groupCatalogByArtist(releases), [releases]);
  const tracks = useMemo(() => allTracks.filter((t) => matchesCatalogTrack(t, query)), [allTracks, query]);
  const artists = useMemo(() => {
    const q = artistKey(query);
    return q ? allArtists.filter((a) => artistKey(a.name).includes(q)) : allArtists;
  }, [allArtists, query]);

  useEffect(() => {
    setVisibleCount(VISIBLE_CHUNK);
  }, [tab, query]);

  const errorMessage = errorToUserString(error);
  const showSkeleton = isLoading && data === undefined;
  const listLength = tab === "tracks" ? tracks.length : artists.length;

  if (adminResolved && !isAdmin) return null;

  if (userId == null && !isAdmin && process.env.NODE_ENV === "production") {
    return (
      <div className="mx-auto max-w-lg px-1 pt-10">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">Каталог</h1>
        <p className="mt-2 text-[15px] text-omf-graphite">Открой приложение из Telegram, чтобы попасть в админку.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-app max-w-lg px-1 pb-40 pt-4 text-omf-ink lg:max-w-3xl">
      <PullRefreshBrand />

      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/admin"
          className="omf-focus -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[14px] text-omf-graphite transition-colors hover:text-omf-ink"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Очередь
        </Link>
        <button
          type="button"
          onClick={() => void mutate(undefined, { revalidate: true })}
          disabled={isValidating}
          aria-label="Обновить каталог"
          className="omf-focus flex h-10 w-10 items-center justify-center rounded-full text-omf-graphite transition-colors hover:bg-omf-surface hover:text-omf-ink disabled:opacity-50"
        >
          <RefreshCcw className={`h-[18px] w-[18px] ${isValidating ? "animate-spin" : ""}`} aria-hidden />
        </button>
      </div>

      <header className="mb-6">
        <p className="text-[13px] text-omf-graphite">Всё, что приняли и отгрузили на площадки</p>
        <h1 className="mt-1 text-[40px] font-extrabold leading-[0.92] tracking-[-0.045em]">Каталог</h1>
      </header>

      {errorMessage && <p className="mb-4 text-[14px] text-omf-red">{errorMessage}</p>}
      {showSkeleton && <AdminModerationQueueSkeleton rows={4} />}

      {data ? (
        <dl className="mb-6 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-omf-line py-4 sm:grid-cols-4">
          {(
            [
              ["Треков", summary.tracks],
              ["Релизов", summary.releases],
              ["Артистов", summary.artists],
              ["Треков за месяц", summary.tracksThisMonth]
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-[13px] text-omf-graphite">{label}</dt>
              <dd className="mt-0.5 text-[28px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {data?.truncated ? (
        <p className="mb-4 text-[14px] text-omf-yellow">Показаны не все релизы — список упёрся в лимит.</p>
      ) : null}

      {releases.length > 0 ? (
        <>
          <div className="mb-4 flex gap-1" role="tablist" aria-label="Что показать">
            {(
              [
                { key: "tracks", label: "Треки", count: tracks.length },
                { key: "artists", label: "Артисты", count: artists.length }
              ] as const
            ).map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    hapticMap.impactLight();
                    setTab(t.key);
                  }}
                  className={cn(
                    "omf-focus shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
                    active ? "bg-omf-ink font-medium text-omf-bg" : "text-omf-graphite hover:text-omf-ink"
                  )}
                >
                  {t.label}
                  <span className={cn("ml-1.5 tabular-nums", active ? "text-omf-bg/70" : "text-omf-faint")}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "tracks" ? "Трек, релиз или артист" : "Артист"}
            aria-label="Поиск по каталогу"
            className="omf-focus mb-2 min-h-[48px] w-full rounded-control border border-omf-line bg-omf-surface px-4 py-3 text-[16px] text-omf-ink placeholder:text-omf-faint focus:border-omf-ultra focus:outline-none"
          />
        </>
      ) : null}

      {!showSkeleton && !errorMessage && data && releases.length === 0 && (
        <div className="border-t border-omf-line pt-6">
          <p className="text-[18px] font-bold tracking-tight">Пока пусто</p>
          <p className="mt-1.5 text-[14px] text-omf-graphite">Здесь появятся треки, когда примешь первый релиз.</p>
        </div>
      )}

      {releases.length > 0 && listLength === 0 && (
        <p className="border-t border-omf-line pt-6 text-[14px] text-omf-graphite">Ничего не нашлось. Поменяй запрос.</p>
      )}

      {tab === "tracks" && tracks.length > 0 ? (
        <ul>
          {tracks.slice(0, visibleCount).map((t) => (
            <li key={t.key} className="border-b border-omf-line">
              <Link
                href={`/admin/release/${t.releaseId}`}
                className="omf-focus -mx-1 flex items-center gap-3 rounded-[10px] px-1 py-3 transition-colors hover:bg-omf-surface"
              >
                <div className="w-11 shrink-0">
                  <ReleaseSleeve
                    seed={t.releaseId}
                    title={t.releaseTitle}
                    artist={t.artist}
                    coverUrl={t.artworkUrl}
                    size="thumb"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[15px] font-bold leading-tight tracking-[-0.01em]">{t.title}</span>
                    {t.explicit ? (
                      <span
                        className="shrink-0 rounded-[4px] bg-omf-surface-2 px-1 text-[10px] font-bold leading-[16px] text-omf-graphite"
                        title="Explicit"
                      >
                        E
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-omf-graphite">
                    {t.artist}
                    {t.featuring.length > 0 ? ` feat. ${t.featuring.join(", ")}` : ""}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-omf-faint">
                    {t.releaseType === "single" ? "Сингл" : `${TYPE_LABEL[t.releaseType]} «${t.releaseTitle}»`} · принят{" "}
                    {formatAcceptedDate(t.acceptedAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {tab === "artists" && artists.length > 0 ? (
        <ul>
          {artists.slice(0, visibleCount).map((a) => (
            <li key={artistKey(a.name)} className="border-b border-omf-line">
              <button
                type="button"
                onClick={() => {
                  hapticMap.impactLight();
                  setQuery(a.name);
                  setTab("tracks");
                  window.scrollTo({ top: 0 });
                }}
                className="omf-focus -mx-1 flex w-[calc(100%+0.5rem)] items-center gap-3 rounded-[10px] px-1 py-3 text-left transition-colors hover:bg-omf-surface"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold leading-tight tracking-[-0.01em]">{a.name}</p>
                  <p className="mt-0.5 text-[13px] text-omf-graphite">
                    {a.releases} {pluralRu(a.releases, ["релиз", "релиза", "релизов"])} · последний{" "}
                    {formatAgoRu(a.lastAcceptedAt)}
                  </p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="block text-[20px] font-extrabold leading-none tabular-nums">{a.tracks}</span>
                  <span className="text-[12px] text-omf-faint">{pluralRu(a.tracks, ["трек", "трека", "треков"])}</span>
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {visibleCount < listLength ? (
        <button
          type="button"
          onClick={() => setVisibleCount((n) => n + VISIBLE_CHUNK)}
          className="omf-btn-secondary mt-5 w-full"
        >
          Показать ещё ({visibleCount} из {listLength})
        </button>
      ) : null}
    </div>
  );
}
