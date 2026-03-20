import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type {
  CreateMetadata,
  CreateReleaseSuccessSummary,
  CreateTrack,
  SubmissionStage,
  SubmissionStatus
} from "./types";
import { isAssetsComplete, isMetadataComplete, isTracksComplete } from "./schemas";

export type CreateReleaseDraftState = {
  // identity / context
  userId: number | null;
  telegramName: string | null;
  // edit mode
  releaseId: string | null;
  clientRequestId: string | null;

  // step data
  metadata: CreateMetadata;
  artworkUrl: string | null;
  tracks: CreateTrack[];
  // non-serializable files — kept in memory only, excluded from persist
  artworkFile: File | null;
  trackFiles: (File | null)[];

  // submission / status
  submitError: string | null;
  submitStatus: SubmissionStatus;
  submitStage: SubmissionStage;
  submitProgress: number;
  successSummary: CreateReleaseSuccessSummary | null;
  hasHydrated: boolean;

  // audit / debug
  lastModified: number | null;
};

type CreateReleaseDraftActions = {
  setUserContext: (args: { userId: number | null; telegramName: string | null }) => void;
  setReleaseId: (releaseId: string | null) => void;
  setClientRequestId: (clientRequestId: string | null) => void;

  setMetadata: (patch: Partial<CreateMetadata>) => void;
  setArtworkUrl: (url: string | null) => void;
  setArtworkFile: (file: File | null) => void;
  setTracks: (tracks: CreateTrack[]) => void;
  setTrackFile: (index: number, file: File | null) => void;
  syncTrackFilesLength: (len: number) => void;

  setSubmitStatus: (status: SubmissionStatus) => void;
  setSubmitStage: (stage: SubmissionStage) => void;
  setSubmitProgress: (progress: number) => void;
  setSubmitError: (error: string | null) => void;
  setSuccessSummary: (summary: CreateReleaseSuccessSummary | null) => void;

  resetDraft: () => void;
  /** После успешной отправки: очистить черновик, оставить successSummary для экрана «Готово». */
  clearCreateFormKeepSummary: () => void;
  setHasHydrated: (value: boolean) => void;
  /** Атомарно заполнить стор из черновика в БД; файлы сессии сбрасываются. */
  resumeFromDraft: (payload: ResumeDraftPayload) => void;
};

export type CreateReleaseDraftStore = CreateReleaseDraftState & CreateReleaseDraftActions;

// Standalone selectors — always recomputed from current state, never frozen by Object.assign
export const selectIsMetadataComplete = (s: CreateReleaseDraftStore) =>
  isMetadataComplete(s.metadata);
export const selectIsAssetsComplete = (s: CreateReleaseDraftStore) =>
  isAssetsComplete({ artworkUrl: s.artworkUrl });
export const selectIsTracksComplete = (s: CreateReleaseDraftStore) =>
  isTracksComplete({ tracks: s.tracks }, s.metadata.releaseType);

/** Данные для восстановления черновика из БД (Dashboard и др.). */
export type ResumeDraftPayload = {
  releaseId: string;
  clientRequestId: string | null;
  metadata: CreateMetadata;
  artworkUrl: string | null;
  tracks: CreateTrack[];
};

const EMPTY_METADATA: CreateMetadata = {
  releaseTitle: "",
  releaseType: "single",
  genre: "",
  subgenre: "",
  language: "",
  label: "",
  artists: [{ name: "", role: "primary" }],
  releaseDate: "",
  explicit: false
};

function areArtistsEqual(
  current: CreateMetadata["artists"],
  next: CreateMetadata["artists"]
) {
  if (current.length !== next.length) return false;
  for (let i = 0; i < current.length; i += 1) {
    if (current[i]?.name !== next[i]?.name) return false;
    if (current[i]?.role !== next[i]?.role) return false;
  }
  return true;
}

function areMetadataEqual(current: CreateMetadata, next: CreateMetadata) {
  return (
    current.releaseTitle === next.releaseTitle &&
    current.releaseType === next.releaseType &&
    current.genre === next.genre &&
    current.subgenre === next.subgenre &&
    current.language === next.language &&
    current.label === next.label &&
    current.releaseDate === next.releaseDate &&
    current.explicit === next.explicit &&
    areArtistsEqual(current.artists, next.artists)
  );
}

function areTracksEqual(current: CreateTrack[], next: CreateTrack[]) {
  if (current.length !== next.length) return false;
  for (let i = 0; i < current.length; i += 1) {
    if (current[i]?.title !== next[i]?.title) return false;
    if (Boolean(current[i]?.explicit) !== Boolean(next[i]?.explicit)) return false;
  }
  return true;
}

export const useCreateReleaseDraftStore = create<CreateReleaseDraftStore>()(
  persist(
    (set) => {
      // Wraps every data-mutating set call with a fresh lastModified timestamp.
      const stamp = () => ({ lastModified: Date.now() });

      return {
        userId: null,
        telegramName: null,
        releaseId: null,
        clientRequestId: null,

        metadata: EMPTY_METADATA,
        artworkUrl: null,
        artworkFile: null,
        tracks: [{ title: "", explicit: false }],
        trackFiles: [null],

        submitError: null,
        submitStatus: "idle",
        submitStage: "idle",
        submitProgress: 0,
        successSummary: null,
        // Starts false so the create layout can show a loader until localStorage
        // has been read. The persist middleware's onRehydrateStorage sets it to
        // true (even when storage is unavailable, so it never stays false forever).
        hasHydrated: false,
        lastModified: null,

        setUserContext: ({ userId, telegramName }) =>
          set((state) => {
            if (state.userId === userId && state.telegramName === telegramName) {
              return state;
            }
            return { userId, telegramName };
          }),
        setReleaseId: (releaseId) =>
          set((state) => (state.releaseId === releaseId ? state : { releaseId })),
        setClientRequestId: (clientRequestId) =>
          set((state) =>
            state.clientRequestId === clientRequestId ? state : { clientRequestId }
          ),

        setMetadata: (patch) =>
          set((state) => {
            const nextMetadata = { ...state.metadata, ...patch };
            if (areMetadataEqual(state.metadata, nextMetadata)) {
              return state;
            }
            return { metadata: nextMetadata, ...stamp() };
          }),
        setArtworkUrl: (url) =>
          set((state) => {
            if (state.artworkUrl === url) return state;
            return { artworkUrl: url, ...stamp() };
          }),
        setArtworkFile: (file) =>
          set((state) => (state.artworkFile === file ? state : { artworkFile: file })),
        setTracks: (tracks) =>
          set((state) => {
            if (areTracksEqual(state.tracks, tracks)) return state;
            return { tracks, ...stamp() };
          }),
        setTrackFile: (index, file) =>
          set((state) => {
            const prev = state.trackFiles;
            const trackCount = state.tracks.length;
            const currentFile = prev[index] ?? null;
            if (currentFile === file && prev.length >= trackCount) {
              return state;
            }
            const next = [...prev];
            while (next.length < trackCount) next.push(null);
            next[index] = file;
            return { trackFiles: next };
          }),
        syncTrackFilesLength: (len) =>
          set((state) => {
            const prev = state.trackFiles;
            if (prev.length === len) return state;
            const next = prev.slice(0, len);
            while (next.length < len) next.push(null);
            return { trackFiles: next };
          }),

        setSubmitStatus: (status) => set({ submitStatus: status }),
        setSubmitStage: (stage) => set({ submitStage: stage }),
        setSubmitProgress: (progress) =>
          set({
            submitProgress: Math.max(0, Math.min(100, Math.round(progress)))
          }),
        setSubmitError: (error) => set({ submitError: error }),
        setSuccessSummary: (summary) => set({ successSummary: summary }),

        resetDraft: () =>
          set({
            releaseId: null,
            clientRequestId: null,
            metadata: EMPTY_METADATA,
            artworkUrl: null,
            artworkFile: null,
            tracks: [{ title: "", explicit: false }],
            trackFiles: [null],
            submitError: null,
            submitStatus: "idle",
            submitStage: "idle",
            submitProgress: 0,
            successSummary: null,
            hasHydrated: true, // already on client, no rehydration needed after reset
            lastModified: null
          }),
        clearCreateFormKeepSummary: () =>
          set({
            releaseId: null,
            clientRequestId: null,
            metadata: EMPTY_METADATA,
            artworkUrl: null,
            artworkFile: null,
            tracks: [{ title: "", explicit: false }],
            trackFiles: [null],
            submitError: null,
            submitStatus: "idle",
            submitStage: "idle",
            submitProgress: 0,
            lastModified: null,
            hasHydrated: true
          }),
        setHasHydrated: (value) =>
          set((state) => (state.hasHydrated === value ? state : { hasHydrated: value })),

        resumeFromDraft: (payload) =>
          set(() => {
            const len = payload.tracks.length;
            const trackFiles: (File | null)[] = [];
            for (let i = 0; i < len; i += 1) trackFiles.push(null);
            return {
              releaseId: payload.releaseId,
              clientRequestId: payload.clientRequestId,
              metadata: payload.metadata,
              artworkUrl: payload.artworkUrl,
              tracks: payload.tracks,
              artworkFile: null,
              trackFiles,
              submitError: null,
              submitStatus: "idle" as SubmissionStatus,
              submitStage: "idle" as SubmissionStage,
              submitProgress: 0,
              successSummary: null,
              hasHydrated: true,
              lastModified: Date.now()
            };
          })
      };
    },
    {
      name: "omf_create_release_draft_v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : ({ getItem: () => null, setItem: () => {}, removeItem: () => {} } as StateStorage)
      ),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          state?.setHasHydrated(true);
          return;
        }
        state?.setHasHydrated(true);
      },
      // artworkFile and trackFiles are intentionally excluded: File objects
      // cannot be serialized to JSON. They live in memory only for the session.
      partialize: (state) => ({
        releaseId: state.releaseId,
        clientRequestId: state.clientRequestId,
        metadata: state.metadata,
        artworkUrl: state.artworkUrl,
        tracks: state.tracks,
        lastModified: state.lastModified,
        successSummary: state.successSummary
      })
    }
  )
);
