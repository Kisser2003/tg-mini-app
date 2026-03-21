"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AudioPlayerLazy } from "@/components/AudioPlayerLazy";
import { GlassCard } from "@/components/GlassCard";
import { approveRelease, rejectRelease } from "@/features/admin/actions";
import { isAdminUi } from "@/lib/admin";
import { sendApprovalNotification } from "@/lib/bot-api";
import { getReleaseStatusMeta, normalizeReleaseStatus } from "@/lib/release-status";
import {
  getReleaseById,
  getReleaseTracksByReleaseId,
  type ReleaseRecord,
  type ReleaseTrackRow
} from "@/repositories/releases.repo";
import { getTelegramUserId, initTelegramWebApp, triggerHaptic } from "@/lib/telegram";

const ARTWORK_SIZES = "(max-width: 768px) 100vw, 33vw";

function buildAudioItems(release: ReleaseRecord, tracks: ReleaseTrackRow[]) {
  if (tracks.length > 0) {
    return tracks
      .filter((t) => t.audio_url && t.audio_url.length > 0)
      .map((t, i) => ({
        key: `${t.index}-${i}`,
        label: t.title.trim() || `Трек ${t.index + 1}`,
        src: t.audio_url as string
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

  const isAdmin = isAdminUi();

  useEffect(() => {
    initTelegramWebApp();
    setUserId(getTelegramUserId());
  }, []);

  const load = useCallback(async () => {
    if (!releaseId || !isAdmin) return;
    setLoading(true);
    setLoadError(null);
    try {
      const row = await getReleaseById(releaseId);
      const tr = await getReleaseTracksByReleaseId(releaseId);
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

  const handleApprove = useCallback(async () => {
    if (!release) return;
    setBusy(true);
    try {
      const updated = await approveRelease(release.id);
      triggerHaptic("success");
      try {
        await sendApprovalNotification(updated);
      } catch (e) {
        console.error("sendApprovalNotification failed:", e);
      }
      toast.success("Релиз одобрен");
      router.push("/admin");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Не удалось одобрить.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, [release, router]);

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

  if (userId == null && process.env.NODE_ENV === "production") {
    return (
      <GlassCard className="p-5">
        <p className="text-sm text-white/65">Открой приложение из Telegram.</p>
      </GlassCard>
    );
  }

  if (!isAdmin) {
    return (
      <GlassCard className="p-5">
        <p className="text-sm text-white/65">Доступ только для администратора.</p>
      </GlassCard>
    );
  }

  if (loading) {
    return (
      <GlassCard className="p-5">
        <p className="text-sm text-white/70">Загрузка…</p>
      </GlassCard>
    );
  }

  if (loadError || !release) {
    return (
      <GlassCard className="p-5">
        <p className="text-sm text-rose-200">{loadError ?? "Релиз не найден."}</p>
        <Link href="/admin" className="mt-3 inline-block text-sm text-[#A5B4FC] underline">
          К очереди
        </Link>
      </GlassCard>
    );
  }

  const statusMeta = getReleaseStatusMeta(release.status);
  const audioItems = buildAudioItems(release, tracks);
  const canModerate = normalizeReleaseStatus(release.status) === "processing";

  return (
    <div className="flex flex-col gap-4 pb-10">
      <GlassCard className="p-5">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-2 text-[13px] text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          К очереди
        </Link>
        <div className="flex gap-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {release.artwork_url ? (
              <Image
                src={release.artwork_url}
                alt=""
                fill
                sizes={ARTWORK_SIZES}
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] text-white/40">
                —
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold tracking-tight">{release.track_name}</h1>
            <p className="break-words text-sm text-white/60">{release.artist_name}</p>
            <span
              className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] ${statusMeta.badgeClassName} ${statusMeta.badgeGlowClassName ?? ""} ${statusMeta.badgeShimmerClassName ?? ""}`}
            >
              {statusMeta.label}
            </span>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
          Аудио
        </p>
        {audioItems.length === 0 ? (
          <p className="text-sm text-white/50">Нет URL аудио в базе.</p>
        ) : (
          <div className="space-y-3">
            {audioItems.map((item) => (
              <AudioPlayerLazy key={item.key} src={item.src} label={item.label} />
            ))}
          </div>
        )}
      </GlassCard>

      {canModerate && (
        <GlassCard className="p-5">
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              disabled={busy}
              onClick={() => {
                triggerHaptic("light");
                void handleApprove();
              }}
              whileHover={{ scale: 0.99 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-3 py-2.5 text-sm text-emerald-100 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              Одобрить
            </motion.button>
            <motion.button
              type="button"
              disabled={busy}
              onClick={() => {
                triggerHaptic("light");
                setRejectOpen((v) => !v);
              }}
              whileHover={{ scale: 0.99 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/40 bg-rose-500/20 px-3 py-2.5 text-sm text-rose-100 disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" />
              Отклонить
            </motion.button>
          </div>
          {rejectOpen && (
            <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/25 p-3">
              <p className="text-xs text-white/65">Причина (колонка error_message)</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Причина отклонения"
                className="w-full resize-none break-words rounded-xl border border-white/[0.08] bg-black/30 px-4 py-3 text-[16px] leading-relaxed text-white outline-none transition-[box-shadow] duration-200 placeholder:text-white/45 focus:ring-2 focus:ring-violet-500/25 focus:ring-offset-0"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectOpen(false)}
                  className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    triggerHaptic("light");
                    void handleReject();
                  }}
                  className="rounded-lg border border-rose-300/35 bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 disabled:opacity-60"
                >
                  Подтвердить
                </button>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {!canModerate && (
        <GlassCard className="p-4 text-sm text-white/60">
          Релиз не в статусе «На проверке» — модерация с этой страницы недоступна.
        </GlassCard>
      )}
    </div>
  );
}
