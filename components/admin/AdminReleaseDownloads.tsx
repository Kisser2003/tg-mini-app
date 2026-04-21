"use client";

import { useCallback, useState } from "react";
import { Download, FileText, Loader2, Archive } from "lucide-react";
import { toast } from "sonner";
import { adminDownloadToDisk } from "@/features/admin/download";
import { triggerHaptic } from "@/lib/telegram";
import type { ReleaseTrackRow } from "@/repositories/releases/types";

type Props = {
  releaseId: string;
  hasArtwork: boolean;
  tracks: ReleaseTrackRow[];
  legacyAudioUrl: string | null;
  /** Сводный текст в `releases.lyrics` (если есть). */
  releaseLyrics?: string | null;
};

export function AdminReleaseDownloads({
  releaseId,
  hasArtwork,
  tracks,
  legacyAudioUrl,
  releaseLyrics
}: Props) {
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const run = useCallback(
    async (key: string, path: string, filenameFallback: string) => {
      setBusyKey(key);
      try {
        await adminDownloadToDisk(path, filenameFallback);
        triggerHaptic("success");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Ошибка загрузки";
        toast.error(msg);
        triggerHaptic("error");
      } finally {
        setBusyKey(null);
      }
    },
    []
  );

  const hasLegacyOnly =
    tracks.filter((t) => t.file_path && t.file_path.length > 0).length === 0 &&
    Boolean(legacyAudioUrl?.trim());

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
        Исходники (без перекодирования)
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {hasArtwork && (
          <button
            type="button"
            disabled={busyKey !== null}
            onClick={() =>
              void run(
                "artwork",
                `/api/admin/releases/${releaseId}/download?kind=artwork`,
                `cover-${releaseId}`
              )
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white/90 hover:bg-white/10 disabled:opacity-50"
          >
            {busyKey === "artwork" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Обложка (оригинал)
          </button>
        )}

        {tracks.map((t, i) => {
          if (!t.file_path?.trim()) return null;
          const key = t.id ? `tr-${t.id}` : `idx-${t.index}-${i}`;
          const q = t.id
            ? `kind=audio&trackId=${encodeURIComponent(t.id)}`
            : `kind=audio&trackIndex=${encodeURIComponent(String(t.index))}`;
          return (
            <button
              key={key}
              type="button"
              disabled={busyKey !== null}
              onClick={() =>
                void run(
                  key,
                  `/api/admin/releases/${releaseId}/download?${q}`,
                  `track-${String(t.index + 1).padStart(2, "0")}-${releaseId}`
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white/90 hover:bg-white/10 disabled:opacity-50"
            >
              {busyKey === key ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Аудио: {t.title.trim() || `Трек ${t.index + 1}`}
            </button>
          );
        })}

        {tracks.map((t, i) => {
          if (!t.lyrics?.trim()) return null;
          const key = t.id ? `lyrics-${t.id}` : `lyrics-idx-${t.index}-${i}`;
          const q = t.id
            ? `kind=lyrics&trackId=${encodeURIComponent(t.id)}`
            : `kind=lyrics&trackIndex=${encodeURIComponent(String(t.index))}`;
          return (
            <button
              key={key}
              type="button"
              disabled={busyKey !== null}
              onClick={() =>
                void run(
                  key,
                  `/api/admin/releases/${releaseId}/download?${q}`,
                  `track-${String(t.index + 1).padStart(2, "0")}-lyrics.txt`
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-300/25 bg-teal-500/15 px-3 py-2.5 text-sm text-teal-100/95 hover:bg-teal-500/25 disabled:opacity-50"
            >
              {busyKey === key ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Текст: {t.title.trim() || `Трек ${t.index + 1}`}
            </button>
          );
        })}

        {releaseLyrics?.trim() ? (
          <button
            type="button"
            disabled={busyKey !== null}
            onClick={() =>
              void run(
                "lyrics-release",
                `/api/admin/releases/${releaseId}/download?kind=lyrics`,
                `release-lyrics-${releaseId.slice(0, 8)}.txt`
              )
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-300/25 bg-teal-500/15 px-3 py-2.5 text-sm text-teal-100/95 hover:bg-teal-500/25 disabled:opacity-50"
          >
            {busyKey === "lyrics-release" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Текст релиза (сводный)
          </button>
        ) : null}

        {hasLegacyOnly && (
          <button
            type="button"
            disabled={busyKey !== null}
            onClick={() =>
              void run(
                "legacy-audio",
                `/api/admin/releases/${releaseId}/download?kind=audio`,
                `master-${releaseId}`
              )
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white/90 hover:bg-white/10 disabled:opacity-50"
          >
            {busyKey === "legacy-audio" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Аудио (legacy)
          </button>
        )}

        <button
          type="button"
          disabled={busyKey !== null}
          onClick={() =>
            void run("zip", `/api/admin/releases/${releaseId}/bundle`, `release-${releaseId}.zip`)
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-300/35 bg-violet-500/20 px-3 py-2.5 text-sm text-violet-100 hover:bg-violet-500/30 disabled:opacity-50"
        >
          {busyKey === "zip" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
          Скачать всё (ZIP)
        </button>
      </div>
      <p className="text-xs text-white/45">
        ZIP: аудио в <span className="font-mono text-white/60">audio/</span>, обложка в{" "}
        <span className="font-mono text-white/60">artwork/</span>, тексты треков (если есть) в{" "}
        <span className="font-mono text-white/60">lyrics/*.txt</span> плюс при необходимости{" "}
        <span className="font-mono text-white/60">release-aggregated.txt</span>, метаданные в{" "}
        <span className="font-mono text-white/60">metadata.json</span>.
      </p>
    </div>
  );
}
