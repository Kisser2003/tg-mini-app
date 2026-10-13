"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Send } from "lucide-react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { toast } from "sonner";
import { AudioPlayerLazy } from "@/components/AudioPlayerLazy";
import { AdminReleaseDownloads } from "@/components/admin/AdminReleaseDownloads";
import { AdminReleaseMetadataCard } from "@/components/admin/AdminReleaseMetadataCard";
import { ReleaseSleeve } from "@/components/ReleaseSleeve";
import { AdminApproveSmartLinkModal } from "@/components/AdminApproveSmartLinkModal";
import { AdminRejectModal } from "@/components/AdminRejectModal";
import { publishReleaseWithSmartLink, rejectRelease } from "@/features/admin/actions";
import { fetchAdminReleaseDetail } from "@/features/admin/release-detail";
import { fetchAdminModerationQueue } from "@/features/admin/moderation-queue";
import { buildAdminReleaseSummary, pickNextReleaseId, type AdminReleaseRow } from "@/lib/admin-release-metadata";
import { SWR_LIST_OPTIONS } from "@/lib/swr-config";
import { cn } from "@/lib/utils";
import { hapticMap } from "@/lib/haptic-map";
import { openTelegramChat } from "@/lib/open-smart-link";
import { isAdminUi, isAdminUiByWebSession } from "@/lib/admin";
import { normalizeReleaseStatus } from "@/lib/release-status";
import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases.repo";
import { getReleaseDisplayTitle } from "@/repositories/releases/types";
import { getTelegramUserId, initTelegramWebApp, triggerHaptic } from "@/lib/telegram";
import { featuringNamesFromCollaboratorsJson } from "@/lib/collaborators";
import { describePreviousRejection } from "@/lib/rejection-reasons";
import { pluralRu } from "@/lib/release-next-step";


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
  const [approveModalReleaseId, setApproveModalReleaseId] = useState<string | null>(null);
  const [metaOpen, setMetaOpen] = useState(false);
  /** Панель решения — в портале: у обёртки страницы transform, `fixed` внутри неё уезжает под навигацию. */
  const [portalReady, setPortalReady] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setPortalReady(true);
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
    setRejectOpen(false);
    setApproveModalReleaseId(null);
    setMetaOpen(false);
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

  /** Тот же ключ, что у очереди на /admin: кэш общий, после решения сразу открываем следующий. */
  const { data: queue, mutate: mutateQueue } = useSWR(
    isAdmin ? (["admin-moderation-queue"] as const) : null,
    () => fetchAdminModerationQueue(),
    SWR_LIST_OPTIONS
  );
  const queueIds = useMemo(() => (queue ?? []).map((row) => row.release.id), [queue]);
  const remainingAfterThis = queueIds.filter((id) => id !== releaseId).length;

  /** После решения: убрать релиз из очереди и открыть следующий (или вернуться к пустой очереди). */
  const goNext = useCallback(
    async (decidedId: string, doneText: string) => {
      const nextId = pickNextReleaseId(queueIds, decidedId);
      void mutateQueue((rows) => rows?.filter((row) => row.release.id !== decidedId), { revalidate: true });
      if (nextId) {
        const left = queueIds.filter((id) => id !== decidedId).length;
        toast.success(`${doneText}. Осталось: ${left}`);
        router.replace(`/admin/release/${nextId}`);
        window.scrollTo({ top: 0 });
        return;
      }
      toast.success(`${doneText}. Очередь разобрана`);
      router.push("/admin");
    },
    [mutateQueue, queueIds, router]
  );

  const handlePublishSmartLink = useCallback(
    async (releaseId: string, newStatus: string, smartLink: string) => {
      setBusy(true);
      try {
        await publishReleaseWithSmartLink(releaseId, newStatus, smartLink);
        triggerHaptic("success");
        setApproveModalReleaseId(null);
        await goNext(releaseId, "Одобрено");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Не удалось выпустить релиз.";
        toast.error(msg);
      } finally {
        setBusy(false);
      }
    },
    [goNext]
  );

  const handleReject = useCallback(async (comment: string, reasonKeys: string[]) => {
    if (!release) return;
    setBusy(true);
    try {
      await rejectRelease(release.id, comment, reasonKeys);
      setRejectOpen(false);
      triggerHaptic("warning");
      await goNext(release.id, "Возвращено артисту");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Не удалось отклонить.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, [release, goNext]);

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
  const previousRejection = describePreviousRejection(release);

  const summary = buildAdminReleaseSummary(release as AdminReleaseRow, tracks);
  const artistUsername = release.telegram_username?.trim().replace(/^@/, "") || null;
  const title = displayTitle || release.track_name || "Релиз";

  return (
    <div className={cn("mx-auto w-full max-w-lg px-1 pt-4 text-omf-ink", canModerate ? "pb-44" : "pb-40")}>
      <AdminRejectModal
        open={rejectOpen}
        busy={busy}
        onClose={() => setRejectOpen(false)}
        onSubmit={(comment, keys) => void handleReject(comment, keys)}
      />

      <AdminApproveSmartLinkModal
        releaseId={approveModalReleaseId}
        busy={approveModalReleaseId != null && busy}
        onClose={() => setApproveModalReleaseId(null)}
        onSubmit={(id, newStatus, smartLink) => void handlePublishSmartLink(id, newStatus, smartLink)}
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/admin"
          className="omf-focus -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[14px] text-omf-graphite transition-colors hover:text-omf-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Очередь
        </Link>
        {canModerate && queue ? (
          <p className="text-[13px] tabular-nums text-omf-graphite">
            {remainingAfterThis > 0 ? `После этого ещё ${remainingAfterThis}` : "Последний в очереди"}
          </p>
        ) : null}
      </div>

      <header className="flex items-start gap-4">
        <div className="w-[38%] max-w-[168px] shrink-0">
          <ReleaseSleeve
            seed={release.id}
            title={title}
            artist={release.artist_name}
            coverUrl={release.artwork_url}
            status={canonical}
            priority
          />
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="break-words text-[24px] font-extrabold leading-[1] tracking-[-0.03em]">{title}</h1>
          <p className="mt-1.5 text-[15px] text-omf-graphite">{release.artist_name}</p>
          {featuringNames.length > 0 ? (
            <p className="mt-0.5 truncate text-[13px] text-omf-graphite" title={featuringNames.join(", ")}>
              feat. {featuringNames.join(", ")}
            </p>
          ) : null}
          {summary.length > 0 ? (
            <p className="mt-2 text-[13px] leading-snug text-omf-faint">{summary.join(" · ")}</p>
          ) : null}
          {artistUsername ? (
            <button
              type="button"
              onClick={() => {
                hapticMap.impactLight();
                openTelegramChat(artistUsername);
              }}
              className="omf-focus mt-2 inline-flex items-center gap-1.5 rounded-full py-1 text-[14px] text-omf-ultra-text hover:text-omf-ink"
            >
              <Send className="h-4 w-4" aria-hidden />
              Написать @{artistUsername}
            </button>
          ) : null}
        </div>
      </header>

      {previousRejection ? (
        <aside
          role="note"
          aria-labelledby="admin-prev-rejection"
          className="mt-6 rounded-control border border-omf-yellow p-4"
        >
          <p id="admin-prev-rejection" className="text-[14px] font-bold text-omf-yellow">
            Повторная отправка
            {previousRejection.count > 1
              ? `: вернули уже ${previousRejection.count} ${pluralRu(previousRejection.count, ["раз", "раза", "раз"])}`
              : ""}
          </p>
          {release.admin_notes?.trim() ? (
            <>
              <p className="mt-1.5 text-[13px] text-omf-graphite">В прошлый раз написали артисту:</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-omf-ink">
                {release.admin_notes.trim()}
              </p>
            </>
          ) : null}
          <p className="mt-2 text-[13px] text-omf-graphite">Сначала проверь, что это исправлено.</p>
        </aside>
      ) : null}

      <section className="mt-6" aria-labelledby="admin-listen">
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

      <section className="mt-6 border-t border-omf-line" aria-labelledby="admin-meta">
        <button
          type="button"
          id="admin-meta"
          aria-expanded={metaOpen}
          aria-controls="admin-meta-body"
          onClick={() => setMetaOpen((v) => !v)}
          className="omf-focus flex w-full items-center justify-between py-3.5 text-left text-[15px] font-medium"
        >
          Все данные релиза
          <ChevronDown
            className={cn("h-4 w-4 text-omf-graphite transition-transform motion-reduce:transition-none", metaOpen && "rotate-180")}
            aria-hidden
          />
        </button>
        {metaOpen ? (
          <div id="admin-meta-body" className="pb-2">
            <AdminReleaseMetadataCard release={release} tracks={tracks} />
          </div>
        ) : null}
      </section>

      <section className="mt-2 border-t border-omf-line pt-4" aria-labelledby="admin-files">
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

      {canModerate && portalReady ? (
        createPortal(
          <div
            role="group"
            aria-label="Решение по релизу"
            className="fixed inset-x-0 bottom-0 z-[60] border-t border-omf-line bg-omf-bg pb-[env(safe-area-inset-bottom,0px)]"
          >
            <div className="mx-auto grid max-w-lg grid-cols-2 gap-2.5 px-4 py-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  triggerHaptic("light");
                  setRejectOpen(true);
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
          </div>,
          document.body
        )
      ) : canModerate ? null : (
        <p className="mt-8 border-t border-omf-line pt-6 text-[14px] leading-relaxed text-omf-graphite">
          Релиз сейчас не «на проверке», поэтому решение здесь принять нельзя.
        </p>
      )}
    </div>
  );
}
