"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Music } from "lucide-react";
import { CreateShell } from "@/features/release/createRelease/components/CreateShell";
import { hapticMap } from "@/lib/haptic-map";
import { StepGate } from "@/features/release/createRelease/components/StepGate";
import { useStepGuard } from "@/features/release/createRelease/guards";
import {
  selectTracksWavFullySynced,
  useCreateReleaseDraftStore
} from "@/features/release/createRelease/store";
import {
  getLastSubmitPrecheckHttpStatus,
  submitTracksAndFinalize
} from "@/features/release/createRelease/actions";
import { getTelegramApiAuthHeaders, getTelegramInitDataForApiHeader } from "@/lib/telegram";
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
import { unionFeaturingNamesFromTracks } from "@/lib/collaborators";

const UploadProgress = dynamic(
  () => import("@/components/UploadProgress").then((m) => m.UploadProgress),
  { ssr: false }
);
const FullScreenLoader = dynamic(
  () => import("@/components/FullScreenLoader").then((m) => m.FullScreenLoader),
  { ssr: false }
);

function SectionDivider() {
  return <div className="my-4 h-px w-full bg-white/10" aria-hidden />;
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
  const successSummary = useCreateReleaseDraftStore((s) => s.successSummary);
  const submitStage = useCreateReleaseDraftStore((s) => s.submitStage);
  const submitProgress = useCreateReleaseDraftStore((s) => s.submitProgress);
  const tracksWavSyncedToDb = useCreateReleaseDraftStore(selectTracksWavFullySynced);
  const tracksUploadInProgress = useCreateReleaseDraftStore((s) => s.tracksUploadInProgress);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressDismissed, setProgressDismissed] = useState(false);
  const prevSubmitErrorRef = useRef<string | null>(null);

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
    if (submitStage === "uploading_tracks")
      return `Загрузка WAV ${Math.round(submitProgress)}%`;
    if (submitStage === "finalizing") return "Передаем релиз в модерацию";
    if (submitStage === "done") return "Готово";
    if (submitStage === "error") return "Ошибка отправки";
    return "Ожидание отправки";
  }, [submitStage, submitProgress]);

  const showProgressPanel =
    submitStatus === "submitting" ||
    submitStatus === "error" ||
    (submitStatus === "success" && !progressDismissed);

  const progressActive = isSubmitting || submitStatus === "submitting";

  const releaseTitle = metadata.releaseTitle?.trim() || "Релиз";
  const artistName = metadata.primaryArtist?.trim() || "Артист";
  const featuringLine = useMemo(
    () => unionFeaturingNamesFromTracks(tracks).join(", "),
    [tracks]
  );

  useEffect(() => {
    if (submitStatus === "success") {
      const t = window.setTimeout(() => setProgressDismissed(true), 450);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [submitStatus]);

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
    let ok = false;
    try {
      ok = await submitTracksAndFinalize({ files });
    } finally {
      setIsSubmitting(false);
    }
    if (!ok) {
      const st = useCreateReleaseDraftStore.getState();
      const msg = st.submitError;
      const precheckStatus = getLastSubmitPrecheckHttpStatus();
      const storeUid = st.userId
        ? Number(st.userId)
        : undefined;
      const authHeaders = getTelegramApiAuthHeaders(
        storeUid != null && Number.isFinite(storeUid) && storeUid > 0
          ? { userId: storeUid }
          : undefined
      );
      const authDebug = {
        note:
          "Authorization не используется; для API нужны X-Telegram-Init-Data и/или (в dev) X-Dev-Telegram-User-Id — см. Network.",
        xTelegramInitDataLength: getTelegramInitDataForApiHeader().length,
        xTelegramInitDataPreview: getTelegramInitDataForApiHeader().slice(0, 320),
        devUserIdHeader: authHeaders["X-Dev-Telegram-User-Id"] ?? null,
        storeUserId: st.userId
      };
      console.error("[CreateReview] submitTracksAndFinalize failed", {
        submitError: msg,
        submitStage: st.submitStage,
        submitStatus: st.submitStatus,
        releaseId: st.releaseId,
        clientRequestId: st.clientRequestId,
        userId: st.userId,
        lastSubmitPrecheckHttpStatus: precheckStatus
      });
      if (
        precheckStatus === 401 ||
        msg === "Unauthorized" ||
        (typeof msg === "string" && msg.includes("подтвердить сессию"))
      ) {
        console.error("[CreateReview] 401 / Telegram auth debug (full)", authDebug);
        alert(
          `401 / Telegram auth\n\n${authDebug.note}\n\ninitData length: ${authDebug.xTelegramInitDataLength}\npreview (truncated):\n${authDebug.xTelegramInitDataPreview}\n\nstore userId: ${String(authDebug.storeUserId)}\nX-Dev-Telegram-User-Id (dev): ${authDebug.devUserIdHeader ?? "—"}`
        );
      }
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
    router.replace("/create/success");
  }, [missingFiles, setSubmitError, trackFiles, router]);

  if (submitStatus === "success" && successSummary) {
    return (
      <CreateShell title="Релиз · Проверка">
        <FullScreenLoader label="Готово — переходим…" />
      </CreateShell>
    );
  }

  if (!guard.allowed) {
    if (guard.title === "Загрузка…") {
      return (
        <CreateShell title="Релиз · Проверка">
          <FullScreenLoader />
        </CreateShell>
      );
    }
    if (isSubmitting || submitStatus === "submitting") {
      return (
        <CreateShell title="Релиз · Проверка">
          <FullScreenLoader label="Отправляем релиз…" />
        </CreateShell>
      );
    }
    return (
      <CreateShell title="Релиз · Проверка">
        <StepGate
          title={guard.title}
          description={guard.description}
          actionLabel={guard.actionLabel}
          onAction={() => router.push(`/create/${guard.redirectTo}`)}
        />
      </CreateShell>
    );
  }

  return (
    <CreateShell title="Релиз · Проверка">
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
              <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#1A1A1E] p-6">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
                  <div className="mx-auto w-full max-w-[168px] shrink-0 sm:mx-0">
                    <div className="relative aspect-square overflow-hidden rounded-md border border-white/10">
                      {artworkUrl ? (
                        <Image
                          src={artworkUrl}
                          alt="Обложка релиза"
                          fill
                          sizes="168px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
                          No cover
                        </div>
                      )}
                    </div>
                  </div>
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
                      className="mt-2 text-[15px] font-medium text-white/75"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.16, duration: 0.35 }}
                    >
                      {artistName}
                    </motion.p>
                  </div>
                </div>

                <SectionDivider />

                <p className="text-[13px] leading-relaxed text-white/80">
                  Проверьте данные перед отправкой.
                  {tracksWavSyncedToDb
                    ? " Аудиофайлы уже на сервере — осталось отправить релиз в модерацию."
                    : " После отправки мы загрузим аудио и передадим релиз в модерацию."}
                </p>

                <SectionDivider />

                <section>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/55">
                    Паспорт
                  </p>
                  <p className="mt-2 break-words text-[15px] text-white/92">
                    {artistName} — {releaseTitle}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/90">
                      {RELEASE_TYPE_RU[metadata.releaseType] ?? metadata.releaseType}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/90">
                      {metadata.genre?.trim() || "Жанр"}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/90">
                      {PERFORMANCE_LANGUAGE_LABELS[metadata.language as PerformanceLanguage] ??
                        metadata.language}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/90">
                      {formatReleaseDateBadge(metadata.releaseDate)}
                    </span>
                    {metadata.explicit ? (
                      <span className="inline-flex items-center rounded-full border border-red-500/25 bg-red-500/15 px-3 py-1 text-xs font-medium text-red-100/95">
                        Explicit
                      </span>
                    ) : null}
                  </div>
                  {featuringLine ? (
                    <p className="mt-3 text-[13px] text-white/70">
                      <span className="font-medium text-white/85">Доп. артисты: </span>
                      {featuringLine}
                    </p>
                  ) : null}
                </section>

                <SectionDivider />

                <section>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/55">
                    Обложка
                  </p>
                  <p className="mt-2 text-[14px] text-white/88">
                    {artworkUrl ? "Загружена" : "Не загружена"}
                  </p>
                </section>

                <SectionDivider />

                <section>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/55">
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
                          <span className="line-clamp-2 max-w-[min(52%,168px)] shrink-0 text-right text-[10px] leading-tight text-white/65">
                            {wavLabel}
                          </span>
                        </motion.li>
                      );
                    })}
                  </ul>
                </section>

                {missingFiles && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-6 overflow-hidden rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-[12px] text-amber-100/90"
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

                <div className="mt-6 border-t border-white/10 pt-6">
                  <AnimatePresence mode="wait">
                    {!progressActive ? (
                      <motion.div
                        key="submit-cta"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <motion.button
                          type="button"
                          disabled={submitBlocked}
                          onClick={() => void handleSubmit()}
                          whileTap={submitBlocked ? undefined : { scale: 0.98 }}
                          whileHover={submitBlocked ? undefined : { scale: 1.01 }}
                          transition={{ type: "spring", stiffness: 420, damping: 28 }}
                          className="create-flow-submit-target relative inline-flex h-[52px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#6366f1] via-[#a855f7] to-[#ec4899] text-[15px] font-semibold text-white ring-1 ring-white/10 transition-transform duration-200 disabled:cursor-not-allowed disabled:bg-none disabled:bg-white/10 disabled:text-white/50 disabled:ring-white/5 disabled:hover:scale-100"
                        >
                          <span className="relative z-[1]">
                            {tracksUploadInProgress ? "Загрузка WAV…" : "Отправить релиз"}
                          </span>
                        </motion.button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <AnimatePresence mode="wait">
                    {showProgressPanel ? (
                      <motion.div
                        key="upload-progress"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className={progressActive ? "" : "mt-4"}
                      >
                        <UploadProgress
                          label={stageLabel}
                          progress={submitProgress}
                          className="border-0 bg-transparent p-0 backdrop-blur-none"
                        />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                {submitError && (
                  <p className="mt-4 break-words text-center text-[11px] leading-relaxed text-red-400">
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
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
    </CreateShell>
  );
}
