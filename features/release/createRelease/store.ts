import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type {
  CreateMetadata,
  CreateReleaseSuccessSummary,
  CreateTrack,
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
  setSubmitError: (error: string | null) => void;
  setSuccessSummary: (summary: CreateReleaseSuccessSummary | null) => void;

  resetDraft: () => void;
  setHasHydrated: (value: boolean) => void;
};

export type CreateReleaseDraftStore = CreateReleaseDraftState & CreateReleaseDraftActions;

// Standalone selectors — always recomputed from current state, never frozen by Object.assign
export const selectIsMetadataComplete = (s: CreateReleaseDraftStore) =>
  isMetadataComplete(s.metadata);
export const selectIsAssetsComplete = (s: CreateReleaseDraftStore) =>
  isAssetsComplete({ artworkUrl: s.artworkUrl });
export const selectIsTracksComplete = (s: CreateReleaseDraftStore) =>
  isTracksComplete({ tracks: s.tracks }, s.metadata.releaseType);

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

export const useCreateReleaseDraftStore = create<CreateReleaseDraftStore>()(
  persist(
    (set, get) => {
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
        successSummary: null,
        // Starts false so the create layout can show a loader until localStorage
        // has been read. The persist middleware's onRehydrateStorage sets it to
        // true (even when storage is unavailable, so it never stays false forever).
        hasHydrated: false,
        lastModified: null,

        setUserContext: ({ userId, telegramName }) => set({ userId, telegramName }),
        setReleaseId: (releaseId) => set({ releaseId }),
        setClientRequestId: (clientRequestId) => set({ clientRequestId }),

        setMetadata: (patch) =>
          set({ metadata: { ...get().metadata, ...patch }, ...stamp() }),
        setArtworkUrl: (url) => set({ artworkUrl: url, ...stamp() }),
        setArtworkFile: (file) => set({ artworkFile: file }),
        setTracks: (tracks) => set({ tracks, ...stamp() }),
        setTrackFile: (index, file) =>
          set({
            trackFiles: (() => {
              const prev = get().trackFiles;
              const next = [...prev];
              while (next.length < get().tracks.length) next.push(null);
              next[index] = file;
              return next;
            })()
          }),
        syncTrackFilesLength: (len) =>
          set({
            trackFiles: (() => {
              const prev = get().trackFiles;
              if (prev.length === len) return prev;
              const next = prev.slice(0, len);
              while (next.length < len) next.push(null);
              return next;
            })()
          }),

        setSubmitStatus: (status) => set({ submitStatus: status }),
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
          successSummary: null,
          hasHydrated: true, // already on client, no rehydration needed after reset
          lastModified: null
          }),
        setHasHydrated: (value) => set({ hasHydrated: value })
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
        userId: state.userId,
        telegramName: state.telegramName,
        releaseId: state.releaseId,
        clientRequestId: state.clientRequestId,
        metadata: state.metadata,
        artworkUrl: state.artworkUrl,
        tracks: state.tracks,
        submitError: state.submitError,
        submitStatus: state.submitStatus,
        successSummary: state.successSummary,
        lastModified: state.lastModified
      })
    }
  )
);
