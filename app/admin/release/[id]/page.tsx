"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AudioPlayerLazy } from "@/components/AudioPlayerLazy";
import { AdminReleaseDownloads } from "@/components/admin/AdminReleaseDownloads";
import { AdminReleaseMetadataCard } from "@/components/admin/AdminReleaseMetadataCard";
import { ReleaseSleeve } from "@/components/ReleaseSleeve";
import { AdminApproveSmartLinkModal } from "@/components/AdminApproveSmartLinkModal";
import { publishReleaseWithSmartLink, rejectRelease } from "@/features/admin/actions";
import { fetchAdminReleaseDetail } from "@/features/admin/release-detail";
import { isAdminUi, isAdminUiByWebSession } from "@/lib/admin";
import { normalizeReleaseStatus } from "@/lib/release-status";
import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases.repo";
import { getReleaseDisplayTitle } from "@/repositories/releases/types";
import { getTelegramUserId, initTelegramWebApp, triggerHaptic } from "@/lib/telegram";
import { featuringNamesFromCollaboratorsJson } from "@/lib/collaborators";


function buildAudioItems(release: ReleaseRecord, tracks: ReleaseTrackRow[]) {
  if (tracks.length > 0) {
    return tracks
      .filter((t) => t.file_path && t.file_path.length > 0)
      .map((t, i) => ({
        key: `${t.index}-${i}`,
        label: t.title.trim() || `Трек ${t.index + 1}`,
        src: t.file_path as string
      }));
  }
  if (release.audio_url) {
    return [
      {
        key: "main",
        label: release.track_name || "Трек",
        src: release.audio_url
      }
    ];
  }
  return [];
}

export default function AdminReleaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const releaseId = params.id;

  const [userId, setUserId] = useState<number | null>(null);
  const [release, setRelease] = useState<ReleaseRecord | null>(null);
  const [tracks, setTracks] = useState<ReleaseTrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveModalReleaseId, setApproveModalReleaseId] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    initTelegramWebApp();
    setUserId(getTelegramUserId());
    setIsAdmin(isAdminUi());
    void (async () => {
      const webAdmin = await isAdminUiByWebSession();
      if (webAdmin) setIsAdmin(true);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!releaseId || !isAdmin) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { release: row, tracks: tr } = await fetchAdminReleaseDetail(releaseId);
      setRelease(row);
      setTracks(tr);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Не удалось загрузить релиз.";
      setLoadError(msg);
      setRelease(null);
    } finally {
      setLoading(false);
    }
  }, [releaseId, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePublishSmartLink = useCallback(
    async (releaseId: string, newStatus: string, smartLink: string) => {
      setBusy(true);
      try {
        await publishReleaseWithSmartLink(releaseId, newStatus, smartLink);
        triggerHaptic("success");
        setApproveModalReleaseId(null);
        toast.success("Релиз выпущен, smart link сохранён");
        router.push("/admin");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Не удалось выпустить релиз.";
        toast.error(msg);
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  const handleReject = useCallback(async () => {
    if (!release) return;
    if (
      !window.confirm(
        "Отклонить релиз? Артист увидит указанную причину в уведомлении."
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await rejectRelease(release.id, rejectReason);
      triggerHaptic("warning");
      toast.success("Релиз отклонён");
      router.push("/admin");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Не удалось отклонить.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, [release, rejectReason, router]);

  if (userId == null && !isAdmin && process.env.NODE_ENV === "production") {
    return (
      <div className="mx-auto max-w-lg px-1 pt-10">
        <p className="text-[15px] text-omf-graphite">Открой приложение из Telegram.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-1 pt-10">
        <p className="text-[15px] text-omf-graphite">Эта страница только для администратора.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-1 pt-10" aria-busy="true">
        <div className="mx-auto aspect-square w-[64%] max-w-[260px] animate-pulse rounded-sleeve bg-omf-surface" />
        <div className="mx-auto mt-6 h-7 w-1/2 animate-pulse rounded bg-omf-surface" />
      </div>
    );
  }

  if (loadError || !release) {
    return (
      <div className="mx-auto max-w-lg px-1 pt-10">
        <h1 className="text-[24px] font-extrabold tracking-[-0.03em]">Не получилось открыть релиз</h1>
        <p className="mt-2 text-[15px] text-omf-graphite">{loadError ?? "Такого релиза нет."}</p>
        <Link href="/admin" className="omf-btn-secondary mt-5 w-full">
          Вернуться к очереди
        </Link>
      </div>
    );
  }

  const canonical = normalizeReleaseStatus(release.status);
  const audioItems = buildAudioItems(release, tracks);
  const canModerate = canonical === "processing";
  const displayTitle = getReleaseDisplayTitle(release);
  const featuringNames = featuringNamesFromCollaboratorsJson(release.collaborators);

  return (
    <div className="mx-auto w-full max-w-lg px-1 pb-40 pt-4 text-omf-ink">
      <AdminApproveSmartLinkModal
        releaseId={approveModalReleaseId}
        busy={approveModalReleaseId != null && busy}
        onClose={() => setApproveModalReleaseId(null)}
        onSubmit={(id, newStatus, smartLink) => void handlePublishSmartLink(id, newStatus, smartLink)}
      />

      <Link
        href="/admin"
        className="omf-focus -ml-2 mb-4 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[14px] text-omf-graphite transition-colors hover:text-omf-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Очередь
      </Link>

      <div className="mx-auto w-[72%] max-w-[300px]">
        <ReleaseSleeve
          seed={release.id}
          title={displayTitle || release.track_name || "Релиз"}
          artist={release.artist_name}
          coverUrl={release.artwork_url}
          status={canonical}
          size="hero"
          priority
        />
      </div>

      <h1 className="mt-7 break-words text-center text-[32px] font-extrabold leading-[0.95] tracking-[-0.04em]">
        {displayTitle || release.track_name || "Релиз"}
      </h1>
      <p className="mt-2 text-center text-[15px] text-omf-graphite">{release.artist_name}</p>
      {featuringNames.length > 0 ? (
        <p className="mt-1 text-center text-[14px] text-omf-graphite" title={featuringNames.join(", ")}>
          feat. {featuringNames.join(", ")}
        </p>
      ) : null}

      <section className="mt-8" aria-labelledby="admin-listen">
        <h2 id="admin-listen" className="mb-2 text-[13px] text-omf-graphite">
          Послушать
        </h2>
        {audioItems.length === 0 ? (
          <p className="text-[14px] text-omf-graphite">Аудио в базе нет, послушать нечего.</p>
        ) : (
          <div className="space-y-2.5">
            {audioItems.map((item) => (
              <AudioPlayerLazy key={item.key} src={item.src} label={item.label} variant="admin" />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="admin-meta">
        <h2 id="admin-meta" className="mb-1 text-[13px] text-omf-graphite">
          Данные релиза
        </h2>
        <AdminReleaseMetadataCard release={release} tracks={tracks} />
      </section>

      <section className="mt-8" aria-labelledby="admin-files">
        <h2 id="admin-files" className="mb-2 text-[13px] text-omf-graphite">
          Файлы
        </h2>
        <AdminReleaseDownloads
          releaseId={release.id}
          hasArtwork={Boolean(release.artwork_url?.trim())}
          tracks={tracks}
          legacyAudioUrl={release.audio_url}
          releaseLyrics={release.lyrics ?? null}
        />
      </section>

      {canModerate ? (
        <section className="mt-8 border-t border-omf-line pt-6" aria-labelledby="admin-decision">
          <h2 id="admin-decision" className="text-[20px] font-bold tracking-tight">
            Решение
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                triggerHaptic("light");
                setRejectOpen((v) => !v);
              }}
              className="omf-btn-secondary w-full disabled:opacity-50"
            >
              Вернуть
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                triggerHaptic("light");
                setApproveModalReleaseId(release.id);
              }}
              className="omf-btn-ink w-full disabled:opacity-50"
            >
              Одобрить
            </button>
          </div>
          {rejectOpen ? (
            <div className="mt-4">
              <label htmlFor="reject-reason" className="text-[13px] text-omf-graphite">
                Что исправить артисту
              </label>
              <textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="Например: обложка меньше 3000×3000"
                className="omf-focus mt-2 w-full resize-none break-words rounded-control border border-omf-line bg-omf-surface px-4 py-3 text-[16px] leading-relaxed text-omf-ink outline-none placeholder:text-omf-faint focus:border-omf-ultra"
              />
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => setRejectOpen(false)} className="omf-btn-secondary w-full">
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    triggerHaptic("light");
                    void handleReject();
                  }}
                  className="omf-btn-primary w-full"
                >
                  {busy ? "Отправляем…" : "Вернуть релиз"}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <p className="mt-8 border-t border-omf-line pt-6 text-[14px] leading-relaxed text-omf-graphite">
          Релиз сейчас не «на проверке», поэтому решение здесь принять нельзя.
        </p>
      )}
    </div>
  );
}
