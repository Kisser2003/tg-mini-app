"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { MagneticButton } from "@/components/MagneticButton";
import { CreateShell } from "@/features/release/createRelease/components/CreateShell";
import { StepGate } from "@/features/release/createRelease/components/StepGate";
import { useStepGuard } from "@/features/release/createRelease/guards";
import { tracksSchema } from "@/features/release/createRelease/schemas";
import type { CreateTracks } from "@/features/release/createRelease/types";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import {
  saveDraftAction,
  uploadTrackWavAtIndex,
  uploadTracksForDraftStep
} from "@/features/release/createRelease/actions";
import { FileUploader } from "@/components/FileUploader";
import { FormFieldError } from "@/components/FormFieldError";
import {
  GLASS_FIELD_ERROR_STRONG,
  WIZARD_FIELD_LABEL_CLASS,
  WIZARD_INPUT_CLASS
} from "@/lib/glass-form-classes";
import {
  acquireTelegramClosingConfirmation,
  releaseTelegramClosingConfirmation,
  triggerHaptic
} from "@/lib/telegram";
import { validateWavFile } from "@/lib/wav-validator";
import { toast } from "sonner";

export default function CreateTracksPage() {
  const router = useRouter();
  const guard = useStepGuard("tracks");

  const releaseType = useCreateReleaseDraftStore((s) => s.metadata.releaseType);
  const releaseTitle = useCreateReleaseDraftStore((s) => s.metadata.releaseTitle);
  const storeTracks = useCreateReleaseDraftStore((s) => s.tracks);
  const storeTrackFiles = useCreateReleaseDraftStore((s) => s.trackFiles);
  const setTracks = useCreateReleaseDraftStore((s) => s.setTracks);
  const setTrackFile = useCreateReleaseDraftStore((s) => s.setTrackFile);
  const setTrackAudioUrlAt = useCreateReleaseDraftStore((s) => s.setTrackAudioUrlAt);
  const syncTrackFilesLength = useCreateReleaseDraftStore((s) => s.syncTrackFilesLength);
  const submitError = useCreateReleaseDraftStore((s) => s.submitError);
  const setSubmitError = useCreateReleaseDraftStore((s) => s.setSubmitError);
  const tracksUploadInProgress = useCreateReleaseDraftStore((s) => s.tracksUploadInProgress);
  const trackAudioUrlsFromDb = useCreateReleaseDraftStore((s) => s.trackAudioUrlsFromDb);

  const showResumeAudioBanner = useMemo(
    () =>
      trackAudioUrlsFromDb.some(
        (url, i) => Boolean(url?.trim()) && !storeTrackFiles[i]
      ),
    [trackAudioUrlsFromDb, storeTrackFiles]
  );

  const isSingle = releaseType === "single";
  const canAddTrack = !isSingle;
  /** Пока false — при смене названия релиза подставляем его в трек; после правки трека не перетираем (фиты / совместные названия). */
  const singleTrackTitleTouchedRef = useRef(false);

  // Compute initial tracks respecting the release-type constraint at mount time.
  // useState initializer runs once, so this captures the correct store snapshot
  // without subscribing to future changes.
  const [initialTracks] = useState<CreateTracks["tracks"]>(() => {
    const { tracks, metadata } = useCreateReleaseDraftStore.getState();
    const base = tracks.length > 0 ? tracks : [{ title: "", explicit: false, lyrics: "" }];
    if (metadata.releaseType === "single") {
      const row = base[0] ?? { title: "", explicit: false, lyrics: "" };
      const trackT = (row.title ?? "").trim();
      const releaseT = (metadata.releaseTitle ?? "").trim();
      return [{ ...row, title: trackT || releaseT }];
    }
    return base;
  });

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isValid, isDirty, dirtyFields, isSubmitting }
  } = useForm<CreateTracks>({
    resolver: zodResolver(tracksSchema),
    mode: "onChange",
    defaultValues: { tracks: initialTracks }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "tracks"
  });

  // Post-mount hydration fix: after the component mounts on the client the
  // Zustand store is fully rehydrated from localStorage. We reset the form once
  // so the displayed values are guaranteed to match the persisted state, even on
  // a hard page-refresh where the SSR pass rendered empty defaults.
  const didHydrateRef = useRef(false);
  useEffect(() => {
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;

    const {
      tracks: storedTracks,
      metadata: { releaseType: storedType, releaseTitle: storedReleaseTitle }
    } = useCreateReleaseDraftStore.getState();

    const base =
      storedTracks.length > 0 ? storedTracks : [{ title: "", explicit: false, lyrics: "" }];
    const freshTracks =
      storedType === "single"
        ? [
            {
              ...(base[0] ?? { title: "", explicit: false, lyrics: "" }),
              title: (() => {
                const trackT = (base[0]?.title ?? "").trim();
                const releaseT = (storedReleaseTitle ?? "").trim();
                return trackT || releaseT;
              })()
            }
          ]
        : base;

    reset({ tracks: freshTracks }, { keepDirty: false });

    if (storedType === "single") {
      const t0 = (freshTracks[0]?.title ?? "").trim();
      const rt = (storedReleaseTitle ?? "").trim();
      singleTrackTitleTouchedRef.current = t0.length > 0 && t0 !== rt;
    }

    // If the cap trimmed the track list, sync the store immediately.
    if (storedType === "single" && storedTracks.length > 1) {
      const trackT = (base[0]?.title ?? "").trim();
      const releaseT = (storedReleaseTitle ?? "").trim();
      setTracks([
        {
          ...(base[0] ?? { title: "", explicit: false, lyrics: "" }),
          title: trackT || releaseT
        }
      ]);
      syncTrackFilesLength(1);
    }
  }, [reset, setTracks, syncTrackFilesLength]);

  // Сингл: по умолчанию название трека = название релиза; если пользователь уже ввёл своё (feat и т.д.) — не затираем.
  useEffect(() => {
    if (!isSingle) return;
    if (singleTrackTitleTouchedRef.current) return;
    setValue("tracks.0.title", releaseTitle, { shouldValidate: true, shouldDirty: false });
  }, [isSingle, releaseTitle, setValue]);

  const values = watch();
  const lastSyncedTracksRef = useRef<string>("");

  // Persist form values to store while editing (debounced).
  useEffect(() => {
    if (!isDirty) return;
    const serializedTracks = JSON.stringify(values.tracks);
    if (serializedTracks === lastSyncedTracksRef.current) return;
    const id = window.setTimeout(() => {
      setTracks(values.tracks);
      syncTrackFilesLength(values.tracks.length);
      lastSyncedTracksRef.current = serializedTracks;
    }, 200);
    return () => window.clearTimeout(id);
  }, [isDirty, setTracks, syncTrackFilesLength, values.tracks]);

  // Keep trackFiles array length in sync whenever the field-array length changes.
  useEffect(() => {
    syncTrackFilesLength(fields.length);
  }, [fields.length, syncTrackFilesLength]);

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [trackUploadProgress, setTrackUploadProgress] = useState<Record<number, number>>({});
  const [activeUploadIndex, setActiveUploadIndex] = useState<number | null>(null);
  const [isUploadingWav, setIsUploadingWav] = useState(false);

  /** Локальный прогресс XHR + флаг стора — блокируем «Далее», пока идёт реальный аплоад. */
  const isWavTransferActive = useMemo(
    () =>
      tracksUploadInProgress ||
      Object.keys(trackUploadProgress).length > 0,
    [tracksUploadInProgress, trackUploadProgress]
  );

  const handleNext = useCallback(
    async (data: CreateTracks) => {
      triggerHaptic("light");
      setSubmitAttempted(true);
      setSubmitError(null);
      setTracks(data.tracks);
      syncTrackFilesLength(data.tracks.length);

      // Re-read files from store at submit time (avoids stale closure).
      const currentFiles = useCreateReleaseDraftStore.getState().trackFiles;
      const missing = data.tracks.some((_t, idx) => !currentFiles[idx]);
      if (missing) {
        const msg = "Загрузите WAV-файл для каждого трека.";
        setSubmitError(msg);
        toast.error(msg);
        return;
      }

      setIsUploadingWav(true);
      setTrackUploadProgress({});
      acquireTelegramClosingConfirmation();
      try {
        const saved = await saveDraftAction();
        if (!saved.ok) {
          toast.error(saved.message);
          setSubmitError(saved.message);
          return;
        }
        const ok = await uploadTracksForDraftStep({
          onTrackProgress: (index, pct) => {
            setActiveUploadIndex(index);
            setTrackUploadProgress((prev) => ({ ...prev, [index]: pct }));
          }
        });
        if (!ok) {
          const msg =
            useCreateReleaseDraftStore.getState().submitError ?? "Не удалось загрузить WAV.";
          if (msg) toast.error(msg);
          return;
        }
        router.push("/create/review");
      } catch (unexpected) {
        console.error("[create/tracks handleNext]", unexpected);
        toast.error("Произошла ошибка. Попробуйте ещё раз.");
      } finally {
        releaseTelegramClosingConfirmation();
        setIsUploadingWav(false);
        setActiveUploadIndex(null);
        setTrackUploadProgress({});
      }
    },
    [router, setSubmitError, setTracks, syncTrackFilesLength]
  );

  return (
    <CreateShell title="Релиз · Треки">
      {!guard.allowed ? (
        <StepGate
          title={guard.title}
          description={guard.description}
          actionLabel={guard.actionLabel}
          onAction={() => router.push(`/create/${guard.redirectTo}`)}
        />
      ) : (
        <form onSubmit={handleSubmit(handleNext)} className="space-y-6">
          {showResumeAudioBanner && (
            <div className="rounded-[18px] border border-sky-500/30 bg-sky-950/35 px-4 py-3 text-[12px] leading-relaxed text-sky-100/95">
              В базе уже есть привязанные WAV для этого черновика, но после возврата из списка
              релизов их нужно{" "}
              <span className="font-semibold text-white">прикрепить заново в этой сессии</span> —
              иначе отправка на модерацию будет недоступна.
            </div>
          )}
          {fields.map((field, index) => (
            <motion.div
              key={field.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-glow glass-glow-charged space-y-6 px-5 py-5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Трек {index + 1}
                </span>
                {canAddTrack && fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      remove(index);
                      syncTrackFilesLength(fields.length - 1);
                    }}
                    className="text-[11px] text-white/40"
                  >
                    Удалить
                  </button>
                )}
              </div>

              {isSingle && index === 0 ? (
                <div className="space-y-1.5">
                  <label className={`mb-2.5 block ${WIZARD_FIELD_LABEL_CLASS}`}>Название трека</label>
                  <p className="mb-1 text-[12px] leading-relaxed text-white/50">
                    Обычно совпадает с названием релиза. Для фита или совместного трека укажите полное
                    название так, как оно должно отображаться в сторе (например, с «feat.» или вторым
                    артистом).
                  </p>
                  <input
                    {...register(`tracks.${index}.title` as const, {
                      onChange: (e) => {
                        const v = e.target.value;
                        singleTrackTitleTouchedRef.current = v.trim().length > 0;
                      }
                    })}
                    placeholder={releaseTitle.trim() || "Как на обложке / в сторе"}
                    className={`${WIZARD_INPUT_CLASS} ${
                      errors.tracks?.[index]?.title && dirtyFields.tracks?.[index]?.title
                        ? GLASS_FIELD_ERROR_STRONG
                        : ""
                    }`}
                  />
                  <FormFieldError message={errors.tracks?.[index]?.title?.message} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className={`mb-2.5 block ${WIZARD_FIELD_LABEL_CLASS}`}>
                    Название трека
                  </label>
                  <input
                    {...register(`tracks.${index}.title` as const)}
                    placeholder="Например, Track 1"
                    className={`${WIZARD_INPUT_CLASS} ${
                      errors.tracks?.[index]?.title && dirtyFields.tracks?.[index]?.title
                        ? GLASS_FIELD_ERROR_STRONG
                        : ""
                    }`}
                  />
                  <FormFieldError message={errors.tracks?.[index]?.title?.message} />
                </div>
              )}

              {/* Pass the stored File reference so the uploader shows "file selected"
                  state when the user navigates back to this step within the session. */}
              <FileUploader
                label="WAV трека"
                accept=".wav,audio/wav,audio/x-wav,audio/wave,audio/vnd.wave"
                maxSizeMb={200}
                type="wav"
                initialFile={storeTrackFiles[index] ?? null}
                onFileChange={(file) => {
                  setTrackFile(index, file);
                  setTrackAudioUrlAt(index, null);
                  if (!file) {
                    setTrackUploadProgress((prev) => {
                      const next = { ...prev };
                      delete next[index];
                      return next;
                    });
                    return;
                  }
                  void (async () => {
                    // Validate WAV spec before initiating upload
                    const validation = await validateWavFile(file);
                    if (!validation.ok) {
                      setTrackFile(index, null);
                      setSubmitError(validation.reason);
                      toast.error(validation.reason);
                      return;
                    }

                    setTrackUploadProgress((prev) => ({ ...prev, [index]: 0 }));
                    const ok = await uploadTrackWavAtIndex({
                      index,
                      file,
                      onProgress: (pct) => {
                        setTrackUploadProgress((prev) => ({ ...prev, [index]: pct }));
                      }
                    });
                    if (ok) {
                      setTrackUploadProgress((prev) => ({ ...prev, [index]: 100 }));
                      window.setTimeout(() => {
                        setTrackUploadProgress((prev) => {
                          const next = { ...prev };
                          delete next[index];
                          return next;
                        });
                      }, 420);
                    } else {
                      setTrackUploadProgress((prev) => {
                        const next = { ...prev };
                        delete next[index];
                        return next;
                      });
                    }
                    if (!ok) {
                      const msg = useCreateReleaseDraftStore.getState().submitError;
                      if (msg) toast.error(msg);
                    }
                  })();
                }}
                invalid={submitAttempted && !storeTrackFiles[index]}
                uploadProgressPercent={
                  typeof trackUploadProgress[index] === "number"
                    ? trackUploadProgress[index]!
                    : isUploadingWav && activeUploadIndex === index
                      ? (trackUploadProgress[index] ?? 0)
                      : null
                }
              />
              <FormFieldError
                message={
                  submitAttempted && !storeTrackFiles[index]
                    ? "Загрузите WAV-файл для этого трека."
                    : undefined
                }
              />

              <div className="space-y-1.5">
                <label
                  htmlFor={`track-${field.id}-lyrics`}
                  className={`mb-2.5 block ${WIZARD_FIELD_LABEL_CLASS}`}
                >
                  Текст песни (лирика)
                </label>
                <textarea
                  id={`track-${field.id}-lyrics`}
                  {...register(`tracks.${index}.lyrics` as const)}
                  rows={5}
                  placeholder="Необязательно. Можно заполнить во время загрузки WAV — текст сохранится вместе с треком."
                  className={`${WIZARD_INPUT_CLASS} min-h-[120px] resize-y py-3`}
                />
                <FormFieldError message={errors.tracks?.[index]?.lyrics?.message} />
              </div>
            </motion.div>
          ))}

          {canAddTrack && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                append({ title: "", explicit: false, lyrics: "" });
                syncTrackFilesLength(fields.length + 1);
              }}
              className="inline-flex h-[44px] w-full items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-[13px] font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              + Добавить трек
            </button>
          )}

          <MagneticButton
            type="submit"
            disabled={!isValid || isSubmitting || isUploadingWav || isWavTransferActive}
            className="create-flow-submit-target pulse-glow inline-flex h-14 w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-[16px] font-bold text-white drop-shadow-[0_0_20px_rgba(168,85,247,0.45)] disabled:opacity-60 disabled:shadow-none"
          >
            {isUploadingWav || isWavTransferActive
              ? "Загружаем WAV…"
              : isSubmitting
                ? "Сохраняем…"
                : "Далее"}
          </MagneticButton>

          <FormFieldError message={submitError ?? undefined} messageClassName="text-center" />
        </form>
      )}
    </CreateShell>
  );
}
