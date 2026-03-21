"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Music } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { CreateShell } from "@/features/release/createRelease/components/CreateShell";
import { hapticMap } from "@/lib/haptic-map";
import { StepGate } from "@/features/release/createRelease/components/StepGate";
import { useStepGuard } from "@/features/release/createRelease/guards";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import { submitTracksAndFinalize } from "@/features/release/createRelease/actions";
import { UploadProgress } from "@/components/UploadProgress";
import { logClientError } from "@/lib/logger";
import {
  acquireTelegramClosingConfirmation,
  releaseTelegramClosingConfirmation,
  triggerHaptic
} from "@/lib/telegram";
import {
  PERFORMANCE_LANGUAGE_LABELS,
  type PerformanceLanguage
} from "@/lib/performance-language";

function SectionDivider() {
  return (
    <div
      className="my-4 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
      aria-hidden
    />
  );
}

function formatReleaseDateBadge(iso: string | undefined): string {
  const d = iso?.trim();
  if (!d) return "—";
  const parsed = new Date(`${d}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

const RELEASE_TYPE_RU: Record<string, string> = {
  single: "Сингл",
  ep: "EP",
  album: "Альбом"
};

function PulsingTrackIcon() {
  return (
    <motion.span
      className="inline-flex shrink-0"
      aria-hidden
      animate={{
        scale: [1, 1.08, 1],
        opacity: [0.75, 1, 0.75]
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      <Music className="h-[18px] w-[18px] text-violet-400/95 drop-shadow-[0_0_12px_rgba(167,139,250,0.35)]" />
    </motion.span>
  );
}

function fireLaunchConfetti() {
  const colors = ["#a855f7", "#6366f1", "#e879f9", "#f0abfc", "#ffffff"];
  const base = { origin: { y: 0.72 }, colors };
  void confetti({ ...base, particleCount: 90, spread: 58, startVelocity: 32 });
  window.setTimeout(() => {
    void confetti({
      ...base,
      particleCount: 55,
      spread: 100,
      scalar: 0.9,
      ticks: 220
    });
  }, 180);
  window.setTimeout(() => {
    void confetti({
      particleCount: 40,
      angle: 120,
      spread: 55,
      origin: { x: 0.15, y: 0.75 },
      colors
    });
    void confetti({
      particleCount: 40,
      angle: 60,
      spread: 55,
      origin: { x: 0.85, y: 0.75 },
      colors
    });
  }, 320);
}

function VinylWithArtwork({ artworkUrl }: { artworkUrl: string | null }) {
  return (
    <div className="relative mx-auto h-[168px] w-[168px] shrink-0 sm:mx-0">
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-zinc-800 via-zinc-950 to-black shadow-[inset_0_0_48px_rgba(0,0,0,0.85),0_12px_40px_rgba(0,0,0,0.5)]"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
      >
        <div
          className="absolute inset-0 rounded-full opacity-[0.45]"
          style={{
            backgroundImage: `repeating-radial-gradient(circle at center, transparent 0, transparent 4px, rgba(255,255,255,0.045) 4px, rgba(255,255,255,0.045) 5px)`
          }}
        />
        <div className="absolute inset-[12%] rounded-full border border-white/[0.06]" />
        <div className="absolute inset-[22%] rounded-full border border-white/[0.04]" />
      </motion.div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative z-10 h-[76px] w-[76px] overflow-hidden rounded-full border-2 border-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.55)] ring-2 ring-black/40">
          {artworkUrl ? (
            <Image
              src={artworkUrl}
              alt=""
              fill
              sizes="76px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.07] to-black/40 text-[10px] font-medium uppercase tracking-wider text-white/35">
              OMF
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CreateReviewPage() {
  const router = useRouter();
  const guard = useStepGuard("review");

  const metadata = useCreateReleaseDraftStore((s) => s.metadata);
  const artworkUrl = useCreateReleaseDraftStore((s) => s.artworkUrl);
  const tracks = useCreateReleaseDraftStore((s) => s.tracks);
  const trackFiles = useCreateReleaseDraftStore((s) => s.trackFiles);
  const trackAudioUrlsFromDb = useCreateReleaseDraftStore((s) => s.trackAudioUrlsFromDb);
  const submitError = useCreateReleaseDraftStore((s) => s.submitError);
  const setSubmitError = useCreateReleaseDraftStore((s) => s.setSubmitError);
  const submitStatus = useCreateReleaseDraftStore((s) => s.submitStatus);
  const submitStage = useCreateReleaseDraftStore((s) => s.submitStage);
  const submitProgress = useCreateReleaseDraftStore((s) => s.submitProgress);
  const tracksWavSyncedToDb = useCreateReleaseDraftStore((s) => s.tracksWavSyncedToDb);
  const tracksUploadInProgress = useCreateReleaseDraftStore((s) => s.tracksUploadInProgress);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressDismissed, setProgressDismissed] = useState(false);
  const prevSubmitErrorRef = useRef<string | null>(null);
  const pendingSuccessNavRef = useRef(false);
  const successNavFallbackTimerRef = useRef<number | null>(null);

  const missingFiles = useMemo(() => {
    if (tracksWavSyncedToDb) return false;
    return tracks.some((_t, i) => !trackFiles[i]);
  }, [tracksWavSyncedToDb, trackFiles, tracks]);
  const submitBlocked =
    missingFiles ||
    tracksUploadInProgress ||
    isSubmitting ||
    submitStatus === "submitting" ||
    submitStatus === "success";

  const stageLabel = useMemo(() => {
    if (submitStage === "preparing") return "Подготавливаем релиз";
    if (submitStage === "uploading_tracks") return "Загружаем WAV-файлы";
    if (submitStage === "finalizing") return "Передаем релиз в модерацию";
    if (submitStage === "done") return "Готово";
    if (submitStage === "error") return "Ошибка отправки";
    return "Ожидание отправки";
  }, [submitStage]);

  const showProgressPanel =
    submitStatus === "submitting" ||
    submitStatus === "error" ||
    (submitStatus === "success" && !progressDismissed);

  const releaseTitle = metadata.releaseTitle?.trim() || "Релиз";
  const artistName = metadata.primaryArtist?.trim() || "Артист";

  useEffect(() => {
    if (submitStatus === "success") {
      const t = window.setTimeout(() => setProgressDismissed(true), 450);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [submitStatus]);

  useEffect(() => {
    return () => {
      if (successNavFallbackTimerRef.current != null) {
        window.clearTimeout(successNavFallbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const busy = isSubmitting || submitStatus === "submitting";
    if (!busy) return;
    acquireTelegramClosingConfirmation();
    return () => releaseTelegramClosingConfirmation();
  }, [isSubmitting, submitStatus]);

  useEffect(() => {
    if (submitError && submitError !== prevSubmitErrorRef.current) {
      const isFileRelated = /wav|файл|загруз/i.test(submitError);
      if (isFileRelated) {
        hapticMap.notificationError();
      }
    }
    prevSubmitErrorRef.current = submitError;
  }, [submitError]);

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    setProgressDismissed(false);
    pendingSuccessNavRef.current = false;
    if (missingFiles) {
      const msg =
        "Не хватает WAV-файлов в этой сессии. Загрузите их на шаге «Треки» — даже если в базе уже есть старые файлы.";
      setSubmitError(msg);
      hapticMap.notificationError();
      toast.error(msg);
      logClientError({
        error: new Error("review_precheck_missing_wav"),
        screenName: "CreateReview_precheck",
        route: "/create/review",
        extra: { phase: "precheck", kind: "missing_session_wav" }
      });
      return;
    }
    hapticMap.notificationSuccess();
    const files = trackFiles.filter(Boolean) as File[];
    setIsSubmitting(true);
    const ok = await submitTracksAndFinalize({ files });
    setIsSubmitting(false);
    if (!ok) {
      const st = useCreateReleaseDraftStore.getState();
      const msg = st.submitError;
      const toastText = msg ?? "Не удалось отправить релиз на модерацию. Статус не изменён.";
      hapticMap.notificationError();
      toast.error(toastText);
      logClientError({
        error: new Error(toastText),
        screenName: "CreateReview_submitResult",
        route: "/create/review",
        extra: {
          phase: "after_submitTracksAndFinalize",
          submitStage: st.submitStage,
          submitStatus: st.submitStatus,
          detailLoggedInActions: true
        }
      });
      return;
    }
    fireLaunchConfetti();
    pendingSuccessNavRef.current = true;
    if (successNavFallbackTimerRef.current != null) {
      window.clearTimeout(successNavFallbackTimerRef.current);
    }
    successNavFallbackTimerRef.current = window.setTimeout(() => {
      successNavFallbackTimerRef.current = null;
      if (pendingSuccessNavRef.current) {
        pendingSuccessNavRef.current = false;
        router.push("/create/success");
      }
    }, 2800);
  }, [missingFiles, setSubmitError, trackFiles, router]);

  const handleProgressExitComplete = useCallback(() => {
    if (successNavFallbackTimerRef.current != null) {
      window.clearTimeout(successNavFallbackTimerRef.current);
      successNavFallbackTimerRef.current = null;
    }
    if (pendingSuccessNavRef.current) {
      pendingSuccessNavRef.current = false;
      router.push("/create/success");
    }
  }, [router]);

  return (
    <CreateShell title="Релиз · Проверка">
      {!guard.allowed ? (
        <StepGate
          title={guard.title}
          description={guard.description}
          actionLabel={guard.actionLabel}
          onAction={() => router.push(`/create/${guard.redirectTo}`)}
        />
      ) : (
        <div className="relative isolate min-h-[min(100dvh,720px)]">
          {artworkUrl ? (
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
              <motion.div
                className="absolute left-1/2 top-[18%] h-[min(140vw,520px)] w-[min(140vw,520px)] -translate-x-1/2"
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: [1.1, 1, 1.1] }}
                transition={{
                  opacity: { duration: 0.6 },
                  scale: { duration: 10, repeat: Infinity, ease: "easeInOut" }
                }}
              >
                <div
                  className="h-full w-full scale-150 bg-cover bg-center opacity-30 blur-[100px]"
                  style={{ backgroundImage: `url(${artworkUrl})` }}
                  aria-hidden
                />
              </motion.div>
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div
              key="review-premium"
              className="space-y-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
                <VinylWithArtwork artworkUrl={artworkUrl} />
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <motion.h2
                    className="text-[clamp(1.35rem,4.5vw,1.85rem)] font-semibold leading-[1.15] tracking-[0.02em] text-white"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08, duration: 0.4 }}
                  >
                    {releaseTitle}
                  </motion.h2>
                  <motion.p
                    className="mt-2 text-[15px] font-medium text-white/45"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.16, duration: 0.35 }}
                  >
                    {artistName}
                  </motion.p>
                </div>
              </div>

              <GlassCard className="border-white/[0.12] p-5 backdrop-blur-xl sm:p-6" shimmer={false}>
                <p className="text-[13px] leading-relaxed text-text-muted">
                  Проверьте данные перед отправкой.
                  {tracksWavSyncedToDb
                    ? " Аудиофайлы уже на сервере — осталось отправить релиз в модерацию."
                    : " После отправки мы загрузим аудио и передадим релиз в модерацию."}
                </p>

                <SectionDivider />

                <section>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
                    Паспорт
                  </p>
                  <p className="mt-2 break-words text-[15px] text-white/92">
                    {artistName} — {releaseTitle}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
                      {RELEASE_TYPE_RU[metadata.releaseType] ?? metadata.releaseType}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
                      {metadata.genre?.trim() || "Жанр"}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
                      {PERFORMANCE_LANGUAGE_LABELS[metadata.language as PerformanceLanguage] ??
                        metadata.language}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
                      {formatReleaseDateBadge(metadata.releaseDate)}
                    </span>
                    {metadata.explicit ? (
                      <span className="inline-flex items-center rounded-full border border-red-500/25 bg-red-500/15 px-3 py-1 text-xs font-medium text-red-100/95 backdrop-blur-md">
                        Explicit
                      </span>
                    ) : null}
                  </div>
                </section>

                <SectionDivider />

                <section>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
                    Обложка
                  </p>
                  <p className="mt-2 text-[14px] text-white/78">
                    {artworkUrl ? "Загружена" : "Не загружена"}
                  </p>
                </section>

                <SectionDivider />

                <section>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
                    Треки
                  </p>
                  <ul className="mt-3 space-y-3 text-white/85">
                    {tracks.map((t, i) => {
                      const hasFile = Boolean(trackFiles[i]);
                      const dbUrl = trackAudioUrlsFromDb[i] ?? null;
                      const wavLabel = tracksWavSyncedToDb
                        ? "Аудио на сервере ✓"
                        : hasFile
                          ? "Файл в черновике ✓"
                          : dbUrl
                            ? "Нужна повторная загрузка аудио для отправки"
                            : "Аудио не добавлено";
                      return (
                        // eslint-disable-next-line react/no-array-index-key
                        <motion.li
                          key={i}
                          className="flex min-w-0 items-center justify-between gap-3"
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * i, duration: 0.35 }}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <PulsingTrackIcon />
                            <span className="min-w-0 truncate text-[14px]">
                              {i + 1}. {t.title || "Без названия"}
                            </span>
                          </div>
                          <span className="line-clamp-2 max-w-[min(52%,168px)] shrink-0 text-right text-[10px] leading-tight text-white/38">
                            {wavLabel}
                          </span>
                        </motion.li>
                      );
                    })}
                  </ul>
                </section>
              </GlassCard>

              {missingFiles && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="overflow-hidden rounded-[18px] border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-[12px] text-amber-100/90"
                >
                  <p>
                    Для отправки нужны WAV-файлы в этой сессии (после возврата из черновика их
                    нужно прикрепить заново).{" "}
                    <Link
                      href="/create/tracks"
                      className="font-medium text-amber-200 underline underline-offset-2"
                    >
                      Вернуться и загрузить треки
                    </Link>
                  </p>
                </motion.div>
              )}

              <motion.button
                type="button"
                disabled={submitBlocked}
                onClick={() => void handleSubmit()}
                whileTap={submitBlocked ? undefined : { scale: 0.98 }}
                whileHover={submitBlocked ? undefined : { scale: 1.02 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                className="group relative inline-flex h-[58px] w-full items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-r from-[#6366f1] via-[#a855f7] to-[#ec4899] text-[16px] font-semibold text-white shadow-[0_16px_44px_rgba(168,85,247,0.35)] transition-transform duration-200 hover:shadow-[0_18px_52px_rgba(168,85,247,0.45)] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:hover:scale-100"
              >
                <span
                  className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
                  style={{
                    background:
                      "linear-gradient(110deg, transparent 0%, transparent 38%, rgba(255,255,255,0.12) 50%, transparent 62%, transparent 100%)",
                    backgroundSize: "200% 100%",
                    animation: submitBlocked ? "none" : "review-btn-shimmer 3.2s ease-in-out infinite"
                  }}
                  aria-hidden
                />
                <motion.span
                  className="pointer-events-none absolute inset-y-0 left-0 w-[38%] skew-x-[-16deg] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-60"
                  animate={submitBlocked ? undefined : { x: ["-130%", "230%"] }}
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    ease: "linear",
                    repeatDelay: 0.35
                  }}
                />
                <span className="relative z-[1] drop-shadow-sm">
                  {tracksUploadInProgress
                    ? "Загрузка WAV…"
                    : isSubmitting || submitStatus === "submitting"
                      ? "Отправляем..."
                      : "Отправить релиз"}
                </span>
              </motion.button>

              <AnimatePresence mode="wait" onExitComplete={handleProgressExitComplete}>
                {showProgressPanel && (
                  <motion.div
                    key="upload-progress"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <UploadProgress label={stageLabel} progress={submitProgress} />
                  </motion.div>
                )}
              </AnimatePresence>

              {submitError && (
                <p className="break-words text-center text-[11px] leading-relaxed text-red-400">
                  {submitError}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      router.push("/create/tracks");
                    }}
                    className="inline font-medium text-red-300 underline underline-offset-2"
                  >
                    Вернуться и загрузить треки
                  </button>
                  {" · "}
                  Попробуйте снова после загрузки файлов.
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </CreateShell>
  );
}
