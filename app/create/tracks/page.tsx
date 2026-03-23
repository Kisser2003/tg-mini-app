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
import { GLASS_FIELD_BASE, GLASS_FIELD_ERROR_STRONG } from "@/lib/glass-form-classes";
import {
  acquireTelegramClosingConfirmation,
  releaseTelegramClosingConfirmation,
  triggerHaptic
} from "@/lib/telegram";
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

  // Compute initial tracks respecting the release-type constraint at mount time.
  // useState initializer runs once, so this captures the correct store snapshot
  // without subscribing to future changes.
  const [initialTracks] = useState<CreateTracks["tracks"]>(() => {
    const { tracks, metadata } = useCreateReleaseDraftStore.getState();
    const base = tracks.length > 0 ? tracks : [{ title: "", explicit: false }];
    if (metadata.releaseType === "single") {
      return [{ ...(base[0] ?? { explicit: false }), title: metadata.releaseTitle }];
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
      storedTracks.length > 0 ? storedTracks : [{ title: "", explicit: false }];
    const freshTracks =
      storedType === "single"
        ? [{ ...(base[0] ?? { explicit: false }), title: storedReleaseTitle }]
        : base;

    reset({ tracks: freshTracks }, { keepDirty: false });

    // If the cap trimmed the track list, sync the store immediately.
    if (storedType === "single" && storedTracks.length > 1) {
      setTracks([{ ...(base[0] ?? { explicit: false }), title: storedReleaseTitle }]);
      syncTrackFilesLength(1);
    }
  }, [reset, setTracks, syncTrackFilesLength]);

  // Сингл: название трека = название релиза из стора (в т.ч. после правок на «Паспорте»).
  useEffect(() => {
    if (!isSingle) return;
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
        <form onSubmit={handleSubmit(handleNext)} className="space-y-4">
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
              className="rounded-[24px] border border-white/[0.08] bg-surface/80 px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Трек {index + 1}
                </span>
                {canAddTrack && fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
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
                <div className="space-y-3">
                  <div className="rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] leading-relaxed text-white/65">
                    Для синглов название трека совпадает с названием релиза.
                  </div>
                  <div className="rounded-[16px] border border-white/[0.08] bg-black/20 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">
                      Название трека
                    </span>
                    <p className="mt-1.5 break-words text-[15px] font-medium leading-snug text-white/95">
                      {releaseTitle.trim() ? releaseTitle : "Как в паспорте релиза"}
                    </p>
                  </div>
                  <FormFieldError message={errors.tracks?.[index]?.title?.message} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                    Название трека
                  </label>
                  <input
                    {...register(`tracks.${index}.title` as const)}
                    placeholder="Например, Track 1"
                    className={`${GLASS_FIELD_BASE} rounded-[16px] ${
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
                accept=".wav"
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
                    setTrackUploadProgress((prev) => ({ ...prev, [index]: 0 }));
                    const ok = await uploadTrackWavAtIndex({
                      index,
                      file,
                      onProgress: (pct) => {
                        setTrackUploadProgress((prev) => ({ ...prev, [index]: pct }));
                      }
                    });
                    setTrackUploadProgress((prev) => {
                      const next = { ...prev };
                      delete next[index];
                      return next;
                    });
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
            </motion.div>
          ))}

          {canAddTrack && (
            <button
              type="button"
              onClick={() => {
                append({ title: "", explicit: false });
                syncTrackFilesLength(fields.length + 1);
              }}
              className="inline-flex h-[44px] w-full items-center justify-center rounded-[18px] bg-white/5 text-[13px] font-medium text-white/70 hover:bg-white/8 hover:text-white transition-colors"
            >
              + Добавить трек
            </button>
          )}

          <MagneticButton
            type="submit"
            disabled={!isValid || isSubmitting || isUploadingWav || tracksUploadInProgress}
            className="inline-flex h-[56px] w-full items-center justify-center rounded-[20px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[16px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.6)] disabled:opacity-60 disabled:shadow-none"
          >
            {isUploadingWav || tracksUploadInProgress
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
