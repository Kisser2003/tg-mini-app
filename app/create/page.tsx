"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ReleaseForm } from "@/components/ReleaseForm";
import type { ReleaseStepOneValues } from "@/components/ReleaseForm";
import { TracksForm, TracksFormValues } from "@/components/TracksForm";
import { SuccessScreen } from "@/components/SuccessScreen";
import {
  getTelegramUserDisplayName,
  getTelegramUserId,
  initTelegramWebApp
} from "@/lib/telegram";
import { useCreateRelease } from "@/features/release/hooks/useCreateRelease";
import type { ReleaseStep1Payload, ReleaseRecord } from "@/repositories/releases.repo";
import {
  addReleaseTrack,
  createDraftRelease,
  getReleaseById,
  submitRelease,
  updateRelease,
  uploadReleaseArtwork,
  uploadReleaseTrackAudio
} from "@/repositories/releases.repo";

function OMFBrand() {
  return (
    <span
      className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-[15px] font-semibold tracking-[0.28em] text-transparent"
      style={{ letterSpacing: "0.28em" }}
    >
      OMF 2026
    </span>
  );
}

type SuccessSummary = {
  artistName: string;
  trackName: string;
};

export default function CreateReleasePage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "tracks" | "success">("form");
  const [telegramName, setTelegramName] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<SuccessSummary | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [pendingRelease, setPendingRelease] = useState<ReleaseRecord | null>(null);
  const [pendingArtistName, setPendingArtistName] = useState<string | null>(null);
  const [isSubmittingRelease, setIsSubmittingRelease] = useState(false);
  const [isSubmittingTracks, setIsSubmittingTracks] = useState(false);
  const [step1Values, setStep1Values] = useState<ReleaseStepOneValues | undefined>(
    undefined
  );
  const [tracksValues, setTracksValues] = useState<TracksFormValues | undefined>(
    undefined
  );
  const [editingRelease, setEditingRelease] = useState<ReleaseRecord | null>(null);
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);

  type PersistedState = {
    step: typeof step;
    telegramName: string | null;
    successSummary: SuccessSummary | null;
    submitError: string | null;
    userId: number | null;
    pendingRelease: ReleaseRecord | null;
    pendingArtistName: string | null;
    step1Values?: ReleaseStepOneValues;
    tracksValues?: TracksFormValues;
  };

  const PERSIST_KEY = useMemo(
    () =>
      editingReleaseId
        ? `omf_release_flow_v1_${editingReleaseId}`
        : "omf_release_flow_v1",
    [editingReleaseId]
  );

  const { create, isSaving, error: createError } = useCreateRelease();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const releaseId = params.get("releaseId");
      if (releaseId) {
        setEditingReleaseId(releaseId);
      }
    }

    initTelegramWebApp();
    setTelegramName(getTelegramUserDisplayName());
    setUserId(getTelegramUserId());

    const bootstrap = async () => {
      if (editingReleaseId) {
        try {
          const existing = await getReleaseById(editingReleaseId);
          setEditingRelease(existing);
          setStep("form");

          const initialStepValues: ReleaseStepOneValues = {
            artists: [{ name: existing.artist_name, role: "main" }],
            trackName: existing.track_name,
            releaseType: existing.release_type as "single" | "ep" | "album",
            mainGenre: existing.genre,
            releaseDate: existing.release_date,
            rightHolder: "",
            explicit: existing.explicit
          };
          setStep1Values(initialStepValues);
        } catch (e: any) {
          setSubmitError(
            e?.message ?? "Не удалось загрузить данные релиза для редактирования."
          );
        }
      } else if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(PERSIST_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as PersistedState;
            if (parsed.step) setStep(parsed.step);
            if (parsed.telegramName) setTelegramName(parsed.telegramName);
            if (parsed.successSummary) setSuccessSummary(parsed.successSummary);
            if (parsed.submitError) setSubmitError(parsed.submitError);
            if (parsed.userId !== undefined) setUserId(parsed.userId);
            if (parsed.pendingRelease) setPendingRelease(parsed.pendingRelease);
            if (parsed.pendingArtistName) setPendingArtistName(parsed.pendingArtistName);
            if (parsed.step1Values) setStep1Values(parsed.step1Values);
            if (parsed.tracksValues) setTracksValues(parsed.tracksValues);
          }
        } catch {
          // ignore broken storage
        }
      }
    };

    void bootstrap();
  }, [PERSIST_KEY, editingReleaseId]);

  useEffect(() => {
    if (typeof window === "undefined" || editingReleaseId) return;
    const toPersist: PersistedState = {
      step,
      telegramName,
      successSummary,
      submitError,
      userId,
      pendingRelease,
      pendingArtistName,
      step1Values,
      tracksValues
    };
    try {
      window.localStorage.setItem(PERSIST_KEY, JSON.stringify(toPersist));
    } catch {
      // ignore quota / serialization errors
    }
  }, [
    PERSIST_KEY,
    editingReleaseId,
    step,
    telegramName,
    successSummary,
    submitError,
    userId,
    pendingRelease,
    pendingArtistName,
    step1Values,
    tracksValues
  ]);

  useEffect(() => {
    if (!pendingRelease) return;

    let cancelled = false;

    const sync = async () => {
      try {
        const latest = await getReleaseById(pendingRelease.id);
        if (cancelled) return;

        if (latest.status === "ready") {
          setSuccessSummary({
            artistName: latest.artist_name,
            trackName: latest.track_name
          });
          setStep("success");
        } else if (
          latest.status === "processing" ||
          latest.status === "review" ||
          latest.status === "draft"
        ) {
          if (step !== "tracks") {
            setStep("tracks");
          }

          if (!pendingRelease || pendingRelease.status !== latest.status) {
            setPendingRelease(latest);
          }
        } else if (latest.status === "failed") {
          setSubmitError(
            latest.error_message ??
              "Релиз находится в состоянии failed. Попробуйте создать новый."
          );
        }
      } catch {
        // ignore sync errors
      }
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [pendingRelease, step]);

  const handleSubmitted = (summary: SuccessSummary) => {
    setSuccessSummary(summary);
    setStep("success");
  };
  const handleReset = () => {
    setStep("form");
    router.push("/");
  };

  const handleSubmitRelease = async (args: {
    form: ReleaseStepOneValues;
    audioFile: File;
    artworkFile: File;
  }): Promise<"success" | "tracks"> => {
    if (isSubmittingRelease) {
      return args.form.releaseType === "single" ? "success" : "tracks";
    }

    setIsSubmittingRelease(true);
    const effectiveUserId = userId ?? 0;

    if (!userId) {
      setSubmitError(
        "Не удалось определить Telegram ID пользователя. Релиз будет сохранён с user_id = 0 (только для теста)."
      );
    } else {
      setSubmitError(null);
    }

    const mainArtistName = args.form.artists[0]?.name ?? "";
    const clientRequestId =
      editingRelease?.client_request_id ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

    const step1: ReleaseStep1Payload = {
      user_id: effectiveUserId,
      client_request_id: clientRequestId,
      artist_name: mainArtistName,
      track_name: args.form.trackName,
      release_type: args.form.releaseType,
      genre: args.form.mainGenre,
      release_date: args.form.releaseDate,
      explicit: args.form.explicit
    };

    if (args.form.releaseType === "single") {
      try {
        await create({
          step1,
          audioFile: args.audioFile,
          artworkFile: args.artworkFile
        });
      } catch (err: any) {
        setSubmitError(err?.message ?? "Не удалось создать релиз.");
        setIsSubmittingRelease(false);
        throw err;
      }

      handleSubmitted({
        artistName: mainArtistName,
        trackName: args.form.trackName
      });
      setIsSubmittingRelease(false);
      return "success";
    }

    try {
      const draft = await createDraftRelease(step1);

      const artworkUrl = await uploadReleaseArtwork({
        userId: effectiveUserId,
        releaseId: draft.id,
        file: args.artworkFile
      });

      const updated = await updateRelease(draft.id, {
        artwork_url: artworkUrl
      });

      setPendingRelease(updated);
      setPendingArtistName(mainArtistName);
      setStep("tracks");
    } catch (err: any) {
      setSubmitError(err?.message ?? "Не удалось создать черновик релиза.");
    } finally {
      setIsSubmittingRelease(false);
    }
    return "tracks";
  };

  const handleSubmitTracks = async (tracks: {
    title: string;
    explicit: boolean;
    file: File;
  }[]) => {
    if (!userId || !pendingRelease) {
      setSubmitError("Нет данных релиза для сохранения треков.");
      return;
    }

    if (isSubmittingTracks) {
      return;
    }

    setSubmitError(null);
    setIsSubmittingTracks(true);

    try {
      const uploaded = await Promise.all(
        tracks.map((track, index) =>
          uploadReleaseTrackAudio({
            userId,
            releaseId: pendingRelease.id,
            trackIndex: index,
            file: track.file
          })
        )
      );

      await Promise.all(
        tracks.map((track, index) =>
          addReleaseTrack({
            releaseId: pendingRelease.id,
            index,
            title: track.title,
            explicit: track.explicit,
            audioUrl: uploaded[index]
          })
        )
      );

      await submitRelease(pendingRelease.id);
    } catch (err: any) {
      setSubmitError(err?.message ?? "Не удалось сохранить треки.");
      if (pendingRelease) {
        try {
          await updateRelease(pendingRelease.id, {
            status: "failed",
            error_message: err?.message ?? "Не удалось сохранить треки."
          });
        } catch {
          // ignore
        }
      }
      throw err;
    } finally {
      setIsSubmittingTracks(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-5 py-6 pb-10 text-text">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-6 font-sans">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-3"
        >
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-[12px] text-text-muted hover:text-white transition-colors"
          >
            ← Назад
          </button>
          <OMFBrand />
          {telegramName && (
            <p className="max-w-[140px] truncate text-right text-[12px] text-text-muted">
              Привет, {telegramName}!
            </p>
          )}
        </motion.header>

        <AnimatePresence mode="wait">
          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <ReleaseForm
                onSubmitted={handleSubmitted}
                onSubmitRelease={handleSubmitRelease}
                isSubmitting={isSubmittingRelease || isSaving}
                submitError={submitError ?? createError}
                initialValues={step1Values}
                onChangeValues={setStep1Values}
              />
            </motion.div>
          )}

          {step === "tracks" && pendingRelease && pendingArtistName && (
            <motion.div
              key="tracks"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <TracksForm
                onSubmitted={() => {
                  handleSubmitted({
                    artistName: pendingArtistName,
                    trackName: pendingRelease.track_name
                  });
                }}
                releaseTitle={pendingRelease.track_name}
                artistName={pendingArtistName}
                onSubmitTracks={handleSubmitTracks}
                isSubmitting={isSubmittingTracks}
                submitError={submitError ?? createError}
                initialValues={tracksValues}
                onChangeValues={setTracksValues}
              />
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="pt-10 text-center"
            >
              <SuccessScreen onReset={handleReset} summary={successSummary ?? undefined} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

