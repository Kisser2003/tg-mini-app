"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { CreateShell } from "@/features/release/createRelease/components/CreateShell";
import { StepGate } from "@/features/release/createRelease/components/StepGate";
import { useStepGuard } from "@/features/release/createRelease/guards";
import { tracksSchema } from "@/features/release/createRelease/schemas";
import type { CreateTracks } from "@/features/release/createRelease/types";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import { FileUploader } from "@/components/FileUploader";
import { triggerHaptic } from "@/lib/telegram";

export default function CreateTracksPage() {
  const router = useRouter();
  const guard = useStepGuard("tracks");

  const releaseType = useCreateReleaseDraftStore((s) => s.metadata.releaseType);
  const storeTracks = useCreateReleaseDraftStore((s) => s.tracks);
  const storeTrackFiles = useCreateReleaseDraftStore((s) => s.trackFiles);
  const setTracks = useCreateReleaseDraftStore((s) => s.setTracks);
  const setTrackFile = useCreateReleaseDraftStore((s) => s.setTrackFile);
  const syncTrackFilesLength = useCreateReleaseDraftStore((s) => s.syncTrackFilesLength);
  const submitError = useCreateReleaseDraftStore((s) => s.submitError);
  const setSubmitError = useCreateReleaseDraftStore((s) => s.setSubmitError);
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
    const base =
      storeTracks.length > 0 ? storeTracks : [{ title: "", explicit: false }];
    // Enforce single-track cap: if the user previously had an EP and switched to
    // single, we silently trim to the first track when the page mounts.
    return isSingle ? [base[0]] : base;
  });

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid, isDirty }
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
      metadata: { releaseType: storedType }
    } = useCreateReleaseDraftStore.getState();

    const base =
      storedTracks.length > 0 ? storedTracks : [{ title: "", explicit: false }];
    const freshTracks = storedType === "single" ? [base[0]] : base;

    reset({ tracks: freshTracks }, { keepDirty: false });

    // If the cap trimmed the track list, sync the store immediately.
    if (storedType === "single" && storedTracks.length > 1) {
      setTracks([base[0]]);
      syncTrackFilesLength(1);
    }
  }, [reset, setTracks, syncTrackFilesLength]);

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
        setSubmitError("Загрузите WAV-файл для каждого трека.");
        return;
      }
      router.push("/create/review");
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
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
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

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Название трека
                </label>
                <input
                  {...register(`tracks.${index}.title` as const)}
                  placeholder="Например, Track 1"
                  className="h-[48px] w-full rounded-[16px] bg-black/40 px-4 text-[16px] text-white placeholder:text-white/30 outline-none transition-colors focus:bg-black/60"
                />
                {errors.tracks?.[index]?.title && (
                  <p className="text-[11px] text-red-400">
                    {errors.tracks[index]?.title?.message}
                  </p>
                )}
              </div>

              {/* Pass the stored File reference so the uploader shows "file selected"
                  state when the user navigates back to this step within the session. */}
              <FileUploader
                label="WAV трека"
                accept=".wav"
                maxSizeMb={200}
                type="wav"
                initialFile={storeTrackFiles[index] ?? null}
                onFileChange={(file) => setTrackFile(index, file)}
              />
              {submitAttempted && !storeTrackFiles[index] && (
                <p className="text-[11px] text-red-400">Загрузите WAV-файл для этого трека.</p>
              )}
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

          <button
            type="submit"
            disabled={!isValid}
            className="inline-flex h-[56px] w-full items-center justify-center rounded-[20px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[16px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.6)] disabled:opacity-60 disabled:shadow-none"
          >
            Далее
          </button>

          {submitError && <p className="text-center text-[11px] text-red-400">{submitError}</p>}
        </form>
      )}
    </CreateShell>
  );
}
