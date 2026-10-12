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
        const msg = e instanceof Error ? e.message : "Не удалось скачать файл";
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
      <p className="text-[14px] text-omf-graphite">Оригиналы файлов, без сжатия.</p>
      <div className="flex flex-col gap-2">
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
            className="omf-btn-secondary w-full justify-start gap-3 px-4 text-[14px] disabled:opacity-50"
          >
            {busyKey === "artwork" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Обложка
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
              className="omf-btn-secondary w-full justify-start gap-3 px-4 text-[14px] disabled:opacity-50"
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
              className="omf-btn-secondary w-full justify-start gap-3 px-4 text-[14px] disabled:opacity-50"
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
            className="omf-btn-secondary w-full justify-start gap-3 px-4 text-[14px] disabled:opacity-50"
          >
            {busyKey === "lyrics-release" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Текст релиза
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
            className="omf-btn-secondary w-full justify-start gap-3 px-4 text-[14px] disabled:opacity-50"
          >
            {busyKey === "legacy-audio" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Аудио
          </button>
        )}

        <button
          type="button"
          disabled={busyKey !== null}
          onClick={() =>
            void run("zip", `/api/admin/releases/${releaseId}/bundle`, `release-${releaseId}.zip`)
          }
          className="omf-btn-ink w-full justify-start gap-3 px-4 text-[14px] disabled:opacity-50"
        >
          {busyKey === "zip" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
          Скачать всё (ZIP)
        </button>
      </div>
      <p className="text-[13px] leading-relaxed text-omf-faint">
        В архиве: аудио, обложка, тексты треков и файл metadata.json с данными релиза.
      </p>
    </div>
  );
}
