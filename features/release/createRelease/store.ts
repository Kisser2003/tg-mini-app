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
import { parsePerformanceLanguage } from "@/lib/performance-language";
import { EMPTY_ARTIST_LINKS, type ArtistLinksState } from "@/lib/artist-links";

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
  /** URL аудио из БД после резюме черновика (подсказки UX; не заменяют File при отправке). */
  trackAudioUrlsFromDb: (string | null)[];
  /**
   * WAV уже загружены в Storage и записаны в release_tracks на шаге «Треки»
   * (чтобы не дублировать upload на «Проверке»).
   */
  tracksWavSyncedToDb: boolean;
  /** Идёт загрузка WAV в Storage (блокирует «Отправить» на проверке). */
  tracksUploadInProgress: boolean;

  /** Ссылки на карточки артиста на DSP (глобально на релиз). */
  releaseArtistLinks: ArtistLinksState;

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
  setTrackAudioUrlAt: (index: number, url: string | null) => void;
  setTracksWavSyncedToDb: (value: boolean) => void;
  setTracksUploadInProgress: (value: boolean) => void;

  setReleaseArtistLinks: (patch: Partial<ArtistLinksState>) => void;

  setSubmitStatus: (status: SubmissionStatus) => void;
  setSubmitStage: (stage: SubmissionStage) => void;
  setSubmitProgress: (progress: number) => void;
  setSubmitError: (error: string | null) => void;
  setSuccessSummary: (summary: CreateReleaseSuccessSummary | null) => void;

  resetDraft: () => void;
  /** После успешной отправки: очистить черновик, оставить successSummary для экрана «Готово». */
  clearCreateFormKeepSummary: () => void;
  /**
   * Как clearCreateFormKeepSummary, но не сбрасывает submitStatus/submitStage/submitProgress
   * (нужно для exit-анимации прогресса на Review перед переходом на /create/success).
   */
  clearCreateFormKeepSummaryPreserveSubmit: () => void;
  /** Сбросить только индикаторы отправки (после перехода на экран успеха). */
  resetSubmissionUi: () => void;
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

/** Язык исполнения (паспорт). */
export const selectPerformanceLanguage = (s: CreateReleaseDraftStore) => s.metadata.language;
/** Explicit на уровне релиза (как в БД `explicit`). */
export const selectIsExplicit = (s: CreateReleaseDraftStore) => s.metadata.explicit;
/** Плановая дата релиза (`metadata.releaseDate`). */
export const selectPlannedReleaseDate = (s: CreateReleaseDraftStore) => s.metadata.releaseDate;

/** Данные для восстановления черновика из БД (Dashboard и др.). */
export type ResumeDraftPayload = {
  releaseId: string;
  clientRequestId: string | null;
  metadata: CreateMetadata;
  artworkUrl: string | null;
  tracks: CreateTrack[];
  /** Параллельно индексам `tracks`; для подсказок после резюме. */
  trackAudioUrlsFromDb: (string | null)[];
  releaseArtistLinks: ArtistLinksState;
};

const EMPTY_METADATA: CreateMetadata = {
  releaseTitle: "",
  releaseType: "single",
  genre: "",
  subgenre: "",
  language: "RU",
  label: "",
  primaryArtist: "",
  releaseDate: "",
  explicit: false
};

function areReleaseArtistLinksEqual(a: ArtistLinksState, b: ArtistLinksState): boolean {
  return (
    a.spotify === b.spotify &&
    a.apple === b.apple &&
    a.yandex === b.yandex &&
    a.vk === b.vk
  );
}

function areMetadataEqual(current: CreateMetadata, next: CreateMetadata) {
  return (
    current.releaseTitle === next.releaseTitle &&
    current.releaseType === next.releaseType &&
    current.genre === next.genre &&
    current.subgenre === next.subgenre &&
    current.language === next.language &&
    current.label === next.label &&
    current.primaryArtist === next.primaryArtist &&
    current.releaseDate === next.releaseDate &&
    current.explicit === next.explicit
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

function areTrackFilesEqualLengthAndRefs(
  a: (File | null)[],
  b: (File | null)[]
): boolean {
  if (a.length !== b.length) return false;
  return a.every((f, i) => f === b[i]);
}

function areTrackUrlsEqualLengthAndValues(
  a: (string | null)[],
  b: (string | null)[]
): boolean {
  if (a.length !== b.length) return false;
  return a.every((u, i) => u === b[i]);
}

/** Для сингла: один трек, title = название релиза; усечь файлы/URL до длины 1. */
function syncStateForSingleRelease(
  state: CreateReleaseDraftState,
  nextMetadata: CreateMetadata
): Pick<
  CreateReleaseDraftState,
  "tracks" | "trackFiles" | "trackAudioUrlsFromDb"
> {
  const prev0 = state.tracks[0] ?? { title: "", explicit: false };
  const nextTracks: CreateTrack[] = [
    { ...prev0, title: nextMetadata.releaseTitle }
  ];
  const nextTrackFiles = state.trackFiles.slice(0, 1);
  while (nextTrackFiles.length < 1) nextTrackFiles.push(null);
  const nextUrls = state.trackAudioUrlsFromDb.slice(0, 1);
  while (nextUrls.length < 1) nextUrls.push(null);
  return {
    tracks: nextTracks,
    trackFiles: nextTrackFiles,
    trackAudioUrlsFromDb: nextUrls
  };
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
        trackAudioUrlsFromDb: [],
        tracksWavSyncedToDb: false,
        tracksUploadInProgress: false,

        releaseArtistLinks: { ...EMPTY_ARTIST_LINKS },

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

            let nextTracks = state.tracks;
            let nextTrackFiles = state.trackFiles;
            let nextUrls = state.trackAudioUrlsFromDb;

            if (nextMetadata.releaseType === "single") {
              const synced = syncStateForSingleRelease(state, nextMetadata);
              nextTracks = synced.tracks;
              nextTrackFiles = synced.trackFiles;
              nextUrls = synced.trackAudioUrlsFromDb;
            }

            const metadataSame = areMetadataEqual(state.metadata, nextMetadata);
            const tracksSame = areTracksEqual(state.tracks, nextTracks);
            const filesSame = areTrackFilesEqualLengthAndRefs(
              state.trackFiles,
              nextTrackFiles
            );
            const urlsSame = areTrackUrlsEqualLengthAndValues(
              state.trackAudioUrlsFromDb,
              nextUrls
            );

            if (metadataSame && tracksSame && filesSame && urlsSame) {
              return state;
            }

            const tracksOrFilesChanged = !tracksSame || !filesSame || !urlsSame;

            return {
              metadata: nextMetadata,
              tracks: nextTracks,
              trackFiles: nextTrackFiles,
              trackAudioUrlsFromDb: nextUrls,
              tracksWavSyncedToDb: tracksOrFilesChanged ? false : state.tracksWavSyncedToDb,
              ...stamp()
            };
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
            const prevUrls = state.trackAudioUrlsFromDb;
            const nextUrls = prevUrls.slice(0, tracks.length);
            while (nextUrls.length < tracks.length) nextUrls.push(null);
            return { tracks, trackAudioUrlsFromDb: nextUrls, ...stamp() };
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
            return {
              trackFiles: next,
              tracksWavSyncedToDb: false
            };
          }),
        setTrackAudioUrlAt: (index, url) =>
          set((state) => {
            const next = [...state.trackAudioUrlsFromDb];
            while (next.length <= index) next.push(null);
            if (next[index] === url) return state;
            next[index] = url;
            return { trackAudioUrlsFromDb: next, ...stamp() };
          }),
        setTracksWavSyncedToDb: (value) =>
          set((state) =>
            state.tracksWavSyncedToDb === value ? state : { tracksWavSyncedToDb: value }
          ),
        setTracksUploadInProgress: (value) =>
          set((state) =>
            state.tracksUploadInProgress === value ? state : { tracksUploadInProgress: value }
          ),
        setReleaseArtistLinks: (patch) =>
          set((state) => {
            const next = { ...state.releaseArtistLinks, ...patch };
            if (areReleaseArtistLinksEqual(state.releaseArtistLinks, next)) return state;
            return { releaseArtistLinks: next, ...stamp() };
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
            trackAudioUrlsFromDb: [],
            tracksWavSyncedToDb: false,
            tracksUploadInProgress: false,
            releaseArtistLinks: { ...EMPTY_ARTIST_LINKS },
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
            trackAudioUrlsFromDb: [],
            tracksWavSyncedToDb: false,
            tracksUploadInProgress: false,
            releaseArtistLinks: { ...EMPTY_ARTIST_LINKS },
            submitError: null,
            submitStatus: "idle",
            submitStage: "idle",
            submitProgress: 0,
            lastModified: null,
            hasHydrated: true
          }),
        clearCreateFormKeepSummaryPreserveSubmit: () =>
          set({
            releaseId: null,
            clientRequestId: null,
            metadata: EMPTY_METADATA,
            artworkUrl: null,
            artworkFile: null,
            tracks: [{ title: "", explicit: false }],
            trackFiles: [null],
            trackAudioUrlsFromDb: [],
            tracksWavSyncedToDb: false,
            tracksUploadInProgress: false,
            releaseArtistLinks: { ...EMPTY_ARTIST_LINKS },
            submitError: null,
            lastModified: null,
            hasHydrated: true
          }),
        resetSubmissionUi: () =>
          set({
            submitError: null,
            submitStatus: "idle",
            submitStage: "idle",
            submitProgress: 0
          }),
        setHasHydrated: (value) =>
          set((state) => (state.hasHydrated === value ? state : { hasHydrated: value })),

        resumeFromDraft: (payload) =>
          set(() => {
            const isSingle = payload.metadata.releaseType === "single";

            let tracks: CreateTrack[] = payload.tracks;
            let len = tracks.length;

            if (isSingle) {
              const first = tracks[0] ?? { title: "", explicit: false };
              tracks = [{ ...first, title: payload.metadata.releaseTitle }];
              len = 1;
            }

            const trackFiles: (File | null)[] = [];
            for (let i = 0; i < len; i += 1) trackFiles.push(null);

            let trackAudioUrlsFromDb: (string | null)[];
            if (isSingle) {
              const u0 =
                payload.trackAudioUrlsFromDb && payload.trackAudioUrlsFromDb.length > 0
                  ? payload.trackAudioUrlsFromDb[0] ?? null
                  : null;
              trackAudioUrlsFromDb = [u0];
            } else {
              trackAudioUrlsFromDb =
                payload.trackAudioUrlsFromDb && payload.trackAudioUrlsFromDb.length === len
                  ? payload.trackAudioUrlsFromDb
                  : Array.from({ length: len }, () => null);
            }

            return {
              releaseId: payload.releaseId,
              clientRequestId: payload.clientRequestId,
              metadata: payload.metadata,
              artworkUrl: payload.artworkUrl,
              tracks,
              artworkFile: null,
              trackFiles,
              trackAudioUrlsFromDb,
              tracksWavSyncedToDb: false,
              tracksUploadInProgress: false,
              releaseArtistLinks: { ...payload.releaseArtistLinks },
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
      name: "omf_create_release_draft_v2",
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
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Partial<CreateReleaseDraftState>;
        const rawMeta = p.metadata as unknown as Record<string, unknown> | undefined;
        let mergedMeta =
          p.metadata != null
            ? {
                ...EMPTY_METADATA,
                ...p.metadata,
                language: parsePerformanceLanguage(p.metadata.language)
              }
            : currentState.metadata;
        if (rawMeta && typeof rawMeta.primaryArtist !== "string") {
          const legacyArtists = rawMeta.artists as unknown;
          const legacyName =
            Array.isArray(legacyArtists) &&
            legacyArtists[0] &&
            typeof (legacyArtists[0] as { name?: string }).name === "string"
              ? String((legacyArtists[0] as { name: string }).name)
              : "";
          mergedMeta = {
            ...mergedMeta,
            primaryArtist: legacyName
          };
        }
        const mergedLinks =
          p.releaseArtistLinks != null
            ? { ...EMPTY_ARTIST_LINKS, ...p.releaseArtistLinks }
            : currentState.releaseArtistLinks;
        return {
          ...currentState,
          ...p,
          metadata: mergedMeta,
          releaseArtistLinks: mergedLinks
        };
      },
      // artworkFile and trackFiles are intentionally excluded: File objects
      // cannot be serialized to JSON. They live in memory only for the session.
      partialize: (state) => ({
        releaseId: state.releaseId,
        clientRequestId: state.clientRequestId,
        metadata: state.metadata,
        artworkUrl: state.artworkUrl,
        tracks: state.tracks,
        trackAudioUrlsFromDb: state.trackAudioUrlsFromDb,
        tracksWavSyncedToDb: state.tracksWavSyncedToDb,
        releaseArtistLinks: state.releaseArtistLinks,
        lastModified: state.lastModified,
        successSummary: state.successSummary
      })
    }
  )
);
