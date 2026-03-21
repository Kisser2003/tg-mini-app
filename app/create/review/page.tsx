"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { CreateShell } from "@/features/release/createRelease/components/CreateShell";
import { hapticMap } from "@/lib/haptic-map";
import { StepGate } from "@/features/release/createRelease/components/StepGate";
import { useStepGuard } from "@/features/release/createRelease/guards";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import { submitTracksAndFinalize } from "@/features/release/createRelease/actions";
import { UploadProgress } from "@/components/UploadProgress";
import { logClientError } from "@/lib/logger";
import { setTelegramClosingConfirmation, triggerHaptic } from "@/lib/telegram";

function SectionDivider() {
  return (
    <div
      className="my-4 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
      aria-hidden
    />
  );
}

function AudioVisualizerBars() {
  const pxHeights = [11, 16, 9, 14];
  const patterns: [number, number, number, number, number][] = [
    [0.45, 1, 0.55, 0.8, 0.45],
    [0.5, 0.75, 1, 0.6, 0.5],
    [0.4, 0.95, 0.5, 0.85, 0.4],
    [0.55, 0.65, 0.9, 1, 0.55]
  ];
  return (
    <div
      className="flex h-[18px] w-[22px] shrink-0 items-end justify-center gap-[3px]"
      aria-hidden
    >
      {pxHeights.map((h, i) => (
        <motion.span
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className="w-[3px] origin-bottom rounded-full bg-gradient-to-t from-violet-500/40 to-fuchsia-400/90"
          style={{ height: h }}
          animate={{ scaleY: patterns[i] ?? [0.5, 1, 0.5] }}
          transition={{
            duration: 0.75 + i * 0.08,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.11
          }}
        />
      ))}
    </div>
  );
}

function VinylWithArtwork({ artworkUrl }: { artworkUrl: string | null }) {
  return (
    <div className="relative mx-auto h-[168px] w-[168px] shrink-0 sm:mx-0">
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-zinc-800 via-zinc-950 to-black shadow-[inset_0_0_48px_rgba(0,0,0,0.85),0_12px_40px_rgba(0,0,0,0.5)]"
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
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
  const artistName = metadata.artists?.[0]?.name?.trim() || "Артист";

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
    setTelegramClosingConfirmation(busy);
    return () => setTelegramClosingConfirmation(false);
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
                  <p className="mt-1.5 break-words text-[12px] text-white/50">
                    {metadata.releaseType} · {metadata.genre || "жанр"} ·{" "}
                    {metadata.releaseDate || "дата"}
                  </p>
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
                            <AudioVisualizerBars />
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
                whileTap={submitBlocked ? undefined : { scale: 0.95 }}
                className="relative inline-flex h-[58px] w-full items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-r from-[#6366f1] via-[#a855f7] to-[#ec4899] text-[16px] font-semibold text-white shadow-[0_16px_44px_rgba(168,85,247,0.35)] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
              >
                <motion.span
                  className="pointer-events-none absolute inset-y-0 left-0 w-[42%] skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-70"
                  animate={submitBlocked ? undefined : { x: ["-120%", "220%"] }}
                  transition={{
                    duration: 2.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    repeatDelay: 0.2
                  }}
                />
                <span className="relative z-[1]">
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
