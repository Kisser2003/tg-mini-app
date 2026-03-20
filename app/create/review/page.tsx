"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { CreateShell } from "@/features/release/createRelease/components/CreateShell";
import { StepGate } from "@/features/release/createRelease/components/StepGate";
import { useStepGuard } from "@/features/release/createRelease/guards";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import { submitTracksAndFinalize } from "@/features/release/createRelease/actions";
import { UploadProgress } from "@/components/UploadProgress";
import { logClientError } from "@/lib/logger";
import { triggerHaptic } from "@/lib/telegram";

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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressDismissed, setProgressDismissed] = useState(false);
  const prevSubmitErrorRef = useRef<string | null>(null);
  const pendingSuccessNavRef = useRef(false);
  const successNavFallbackTimerRef = useRef<number | null>(null);

  const missingFiles = useMemo(() => tracks.some((_t, i) => !trackFiles[i]), [trackFiles, tracks]);
  const submitBlocked =
    missingFiles ||
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
    if (submitError && submitError !== prevSubmitErrorRef.current) {
      const isFileRelated = /wav|файл|загруз/i.test(submitError);
      if (isFileRelated) {
        triggerHaptic("error");
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
      toast.error(msg);
      logClientError({
        error: new Error("review_precheck_missing_wav"),
        screenName: "CreateReview_precheck",
        route: "/create/review",
        extra: { phase: "precheck", kind: "missing_session_wav" }
      });
      return;
    }
    triggerHaptic("medium");
    const files = trackFiles.filter(Boolean) as File[];
    setIsSubmitting(true);
    const ok = await submitTracksAndFinalize({ files });
    setIsSubmitting(false);
    if (!ok) {
      const st = useCreateReleaseDraftStore.getState();
      const msg = st.submitError;
      const toastText = msg ?? "Не удалось отправить релиз на модерацию. Статус не изменён.";
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
        <div className="min-h-[min(100dvh,720px)] space-y-4">
          <div className="rounded-[24px] border border-white/[0.08] bg-surface/80 px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
            <p className="text-[13px] text-text-muted leading-relaxed">
              Проверьте данные перед отправкой. Отправка начнёт загрузку WAV и передачу релиза в
              модерацию.
            </p>

            <div className="mt-4 space-y-3 text-[13px]">
              <div className="rounded-[18px] bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Паспорт</p>
                <p className="mt-1 text-white">
                  {metadata.artists?.[0]?.name || "Артист"} — {metadata.releaseTitle || "Релиз"}
                </p>
                <p className="mt-1 text-white/55 text-[12px]">
                  {metadata.releaseType} · {metadata.genre || "жанр"} · {metadata.releaseDate || "дата"}
                </p>
              </div>

              <div className="rounded-[18px] bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Обложка</p>
                <p className="mt-1 text-white/70">
                  {artworkUrl ? "Загружена" : "Не загружена"}
                </p>
              </div>

              <div className="rounded-[18px] bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Треки</p>
                <ul className="mt-2 space-y-1 text-white/80">
                  {tracks.map((t, i) => {
                    const hasFile = Boolean(trackFiles[i]);
                    const dbUrl = trackAudioUrlsFromDb[i] ?? null;
                    const wavLabel = hasFile
                      ? "WAV в сессии ✓"
                      : dbUrl
                        ? "В БД есть, для отправки загрузите WAV снова"
                        : "WAV ✕";
                    return (
                      // eslint-disable-next-line react/no-array-index-key
                      <li key={i} className="flex items-center justify-between gap-3">
                        <span className="truncate">
                          {i + 1}. {t.title || "Без названия"}
                        </span>
                        <span className="max-w-[140px] text-right text-[10px] leading-tight text-white/40">
                          {wavLabel}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>

          {missingFiles && (
            <div className="rounded-[18px] border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-[12px] text-amber-100/90">
              <p>
                Для отправки нужны WAV-файлы в этой сессии (после возврата из черновика их нужно
                прикрепить заново).{" "}
                <Link
                  href="/create/tracks"
                  className="font-medium text-amber-200 underline underline-offset-2"
                >
                  Вернуться и загрузить треки
                </Link>
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={submitBlocked}
            onClick={handleSubmit}
            className="inline-flex h-[56px] w-full items-center justify-center rounded-[20px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[16px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.6)] disabled:opacity-60 disabled:shadow-none"
          >
            {isSubmitting || submitStatus === "submitting" ? "Отправляем..." : "Отправить релиз"}
          </button>

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
            <p className="text-center text-[11px] text-red-400">
              {submitError}{" "}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  router.push("/create/tracks");
                }}
                className="font-medium text-red-300 underline underline-offset-2"
              >
                Вернуться и загрузить треки
              </button>
              {" · "}
              Попробуйте снова после загрузки файлов.
            </p>
          )}
        </div>
      )}
    </CreateShell>
  );
}
