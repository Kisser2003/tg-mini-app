import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReleaseStepOneValues } from "@/components/ReleaseForm";
import type { TracksFormValues } from "@/components/TracksForm";
import {
  getTelegramUserDisplayName,
  getTelegramUserId,
  initTelegramWebApp,
  getTelegramWebApp
} from "@/lib/telegram";
import { formatErrorMessage } from "@/lib/errors";
import type { ReleaseRecord, ReleaseStep1Payload } from "@/repositories/releases.repo";
import {
  addReleaseTrack,
  createDraftRelease,
  getReleaseById,
  submitRelease,
  updateRelease,
  uploadReleaseArtwork,
  uploadReleaseTrackAudio
} from "@/repositories/releases.repo";

export type SuccessSummary = {
  artistName: string;
  trackName: string;
};

type FlowStep = "form" | "tracks" | "success";

type TrackUploadState = "idle" | "uploading" | "done" | "error";

function getDevUserIdOverride(): number | null {
  // Только для локальной отладки. В production игнорируется полностью.
  if (process.env.NODE_ENV === "production") return null;
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("devUserId");
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.trunc(parsed);
  } catch {
    return null;
  }
}

function getDevUserIdDefault(): number | null {
  // Чтобы можно было отлаживаться в браузере без Telegram.
  // В production всегда null.
  if (process.env.NODE_ENV === "production") return null;
  if (typeof window === "undefined") return null;
  // если нет Telegram initData — это обычный браузер
  const hasTelegram = Boolean(getTelegramWebApp()?.initDataUnsafe?.user?.id);
  if (hasTelegram) return null;
  return 1;
}

function uuidV4Fallback(): string {
  // RFC4122 v4, no deps. Good enough for client_request_id.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`;
}

function createClientRequestId(existing?: string | null): string {
  if (existing) return existing;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return uuidV4Fallback();
}

type PersistedState = {
  step: FlowStep;
  telegramName: string | null;
  successSummary: SuccessSummary | null;
  submitError: string | null;
  userId: number | null;
  pendingRelease: ReleaseRecord | null;
  pendingArtistName: string | null;
  step1Values?: ReleaseStepOneValues;
  tracksValues?: TracksFormValues;
};

export type UseCreateReleaseFlowResult = {
  step: FlowStep;
  telegramName: string | null;
  userId: number | null;
  pendingRelease: ReleaseRecord | null;
  pendingArtistName: string | null;
  step1Values: ReleaseStepOneValues | undefined;
  tracksValues: TracksFormValues | undefined;
  isSubmittingRelease: boolean;
  isSubmittingTracks: boolean;
  trackUploadStates: TrackUploadState[];
  submitError: string | null;
  successSummary: SuccessSummary | null;
  goToStep: (next: FlowStep, options?: { source?: "ui" | "url" }) => void;
  goBack: () => void;

  handleStep1Submit: (args: {
    form: ReleaseStepOneValues;
    artworkFile: File;
  }) => Promise<"success" | "tracks">;

  handleTracksSubmit: (tracks: {
    title: string;
    explicit: boolean;
    file: File;
  }[]) => Promise<void>;

  setStep1Values: (values: ReleaseStepOneValues) => void;
  setTracksValues: (values: TracksFormValues) => void;

  handleSubmitted: (summary: SuccessSummary) => void;
  resetFlow: () => void;
};

export function useCreateReleaseFlow(): UseCreateReleaseFlowResult {
  const [step, setStep] = useState<FlowStep>("form");
  const [telegramName, setTelegramName] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<SuccessSummary | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [pendingRelease, setPendingRelease] = useState<ReleaseRecord | null>(null);
  const [pendingArtistName, setPendingArtistName] = useState<string | null>(null);
  const [isSubmittingRelease, setIsSubmittingRelease] = useState(false);
  const [isSubmittingTracks, setIsSubmittingTracks] = useState(false);
  const [step1Values, setStep1Values] = useState<ReleaseStepOneValues | undefined>(undefined);
  const [tracksValues, setTracksValues] = useState<TracksFormValues | undefined>(undefined);
  const [editingRelease, setEditingRelease] = useState<ReleaseRecord | null>(null);
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);
  const [trackUploadStates, setTrackUploadStates] = useState<TrackUploadState[]>([]);

  const PERSIST_KEY = useMemo(
    () =>
      editingReleaseId ? `omf_release_flow_v1_${editingReleaseId}` : "omf_release_flow_v1",
    [editingReleaseId]
  );

  const goToStep = useCallback(
    (next: FlowStep, options?: { source?: "ui" | "url" }) => {
      // guard: нельзя оказаться на tracks/success без данных релиза
      if (next === "tracks" && (!pendingRelease || !pendingArtistName)) {
        setStep("form");
        return;
      }
      if (next === "success" && !successSummary) {
        // если успеха нет — не показываем success
        setStep(pendingRelease ? "tracks" : "form");
        return;
      }
      // options пока используются только для будущего расширения (чтобы избежать циклов)
      void options;
      setStep(next);
    },
    [pendingArtistName, pendingRelease, successSummary]
  );

  const goBack = useCallback(() => {
    if (step === "success") {
      goToStep("tracks", { source: "ui" });
      return;
    }
    if (step === "tracks") {
      goToStep("form", { source: "ui" });
      return;
    }
  }, [goToStep, step]);

  // bootstrap: Telegram, query params, persisted state / editing release
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
      const shouldResume =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("resume") === "1";

      if (editingReleaseId) {
        try {
          const existing = await getReleaseById(editingReleaseId);
          setEditingRelease(existing);
          setStep("form");

          const initialStepValues: ReleaseStepOneValues = {
            artists: [{ name: existing.artist_name, role: "primary" }],
            releaseTitle: existing.track_name,
            releaseType: existing.release_type as "single" | "ep" | "album",
            genre: existing.genre,
            subgenre: "",
            language: "",
            label: existing.artist_name,
            releaseDate: existing.release_date,
            explicit: existing.explicit
          };
          setStep1Values(initialStepValues);
        } catch (e: unknown) {
          setSubmitError(
            formatErrorMessage(
              e,
              "Не удалось загрузить данные релиза для редактирования."
            )
          );
        }
      } else if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(PERSIST_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as PersistedState;
            // Важно: при обычном входе на /create мы НЕ должны авто-перескакивать на следующий шаг.
            // Резюм возможен только по явному флагу resume=1.
            if (shouldResume && parsed.step) setStep(parsed.step);
            if (parsed.telegramName) setTelegramName(parsed.telegramName);
            if (parsed.successSummary) setSuccessSummary(parsed.successSummary);
            if (parsed.submitError) setSubmitError(parsed.submitError);
            if (parsed.userId !== undefined) setUserId(parsed.userId);
            if (shouldResume && parsed.pendingRelease) setPendingRelease(parsed.pendingRelease);
            if (shouldResume && parsed.pendingArtistName) setPendingArtistName(parsed.pendingArtistName);
            if (parsed.step1Values) setStep1Values(parsed.step1Values);
            if (shouldResume && parsed.tracksValues) setTracksValues(parsed.tracksValues);
          }
        } catch {
          // ignore broken storage
        }
      }
    };

    void bootstrap();
  }, [PERSIST_KEY, editingReleaseId]);

  // persist state (only for new release flow)
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

  // sync release status from backend
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

  const handleSubmitted = useCallback((summary: SuccessSummary) => {
    setSuccessSummary(summary);
    setStep("success");
  }, []);

  const handleStep1Submit = useCallback(
    async (args: {
      form: ReleaseStepOneValues;
      artworkFile: File;
    }): Promise<"success" | "tracks"> => {
      if (isSubmittingRelease) {
        return "tracks";
      }

      setIsSubmittingRelease(true);
      const devUserId = getDevUserIdOverride() ?? getDevUserIdDefault();
      const freshUserId = devUserId ?? getTelegramUserId();
      if (freshUserId && freshUserId !== userId) {
        setUserId(freshUserId);
      }
      const effectiveUserId = freshUserId ?? userId ?? 0;
      setSubmitError(null);

      const mainArtistName = args.form.artists[0]?.name ?? "";
      const clientRequestId = createClientRequestId(editingRelease?.client_request_id);

      const step1: ReleaseStep1Payload = {
        user_id: effectiveUserId,
        client_request_id: clientRequestId,
        artist_name: mainArtistName,
        track_name: args.form.releaseTitle,
        release_type: args.form.releaseType,
        genre: args.form.genre,
        release_date: args.form.releaseDate,
        explicit: args.form.explicit
      };

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

        try {
          getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.("success");
        } catch {
          // ignore haptic errors
        }
      } catch (err: unknown) {
        setSubmitError(formatErrorMessage(err, "Не удалось создать черновик релиза."));
      } finally {
        setIsSubmittingRelease(false);
      }
      return "tracks";
    },
    [editingRelease, isSubmittingRelease, userId]
  );

  const handleTracksSubmit = useCallback(
    async (tracks: { title: string; explicit: boolean; file: File }[]) => {
      const devUserId = getDevUserIdOverride() ?? getDevUserIdDefault();
      const effectiveUserId = devUserId ?? userId;

      if (!effectiveUserId || !pendingRelease) {
        setSubmitError("Нет данных релиза для сохранения треков.");
        return;
      }
      if (isSubmittingTracks) return;
      setSubmitError(null);
      setIsSubmittingTracks(true);
      setTrackUploadStates(new Array(tracks.length).fill("idle"));
      try {
        for (let index = 0; index < tracks.length; index += 1) {
          const track = tracks[index];
          setTrackUploadStates((prev) => {
            const next = [...prev];
            next[index] = "uploading";
            return next;
          });
          const audioUrl = await uploadReleaseTrackAudio({
            userId: effectiveUserId,
            releaseId: pendingRelease.id,
            trackIndex: index,
            file: track.file
          });
          await addReleaseTrack({
            releaseId: pendingRelease.id,
            index,
            title: track.title,
            explicit: track.explicit,
            audioUrl
          });
          setTrackUploadStates((prev) => {
            const next = [...prev];
            next[index] = "done";
            return next;
          });
        }
        await submitRelease(pendingRelease.id);

        try {
          getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.("success");
        } catch {
          // ignore haptic errors
        }
      } catch (err: unknown) {
        const message = formatErrorMessage(err, "Не удалось сохранить треки.");
        setSubmitError(message);
        setTrackUploadStates((prev) => prev.map(() => "error"));
        if (pendingRelease) {
          try {
            await updateRelease(pendingRelease.id, {
              status: "failed",
              error_message: message
            });
          } catch {
            // ignore secondary failure
          }
        }
      } finally {
        setIsSubmittingTracks(false);
      }
    },
    [isSubmittingTracks, pendingRelease, userId]
  );

  const resetFlow = useCallback(() => {
    setStep("form");
    setSuccessSummary(null);
    setSubmitError(null);
    setPendingRelease(null);
    setPendingArtistName(null);
    setTrackUploadStates([]);
    // step1Values / tracksValues оставляем — пусть юзер сам сбросит, если нужно
  }, []);

  return {
    step,
    telegramName,
    userId,
    pendingRelease,
    pendingArtistName,
    step1Values,
    tracksValues,
    isSubmittingRelease,
    isSubmittingTracks,
    trackUploadStates,
    submitError,
    successSummary,
    goToStep,
    goBack,
    handleStep1Submit,
    handleTracksSubmit,
    setStep1Values,
    setTracksValues,
    handleSubmitted,
    resetFlow
  };
}

