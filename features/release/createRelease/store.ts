import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type {
  CreateMetadata,
  CreateReleaseSuccessSummary,
  CreateTrack,
  SubmissionStage,
  SubmissionStatus
} from "./types";
import {
  FIXED_RELEASE_LABEL,
  isAssetsComplete,
  isMetadataComplete,
  isTracksComplete
} from "./schemas";
import { unionFeaturingNamesFromTracks } from "@/lib/collaborators";
import { parsePerformanceLanguage } from "@/lib/performance-language";
import { EMPTY_ARTIST_LINKS, type ArtistLinksState } from "@/lib/artist-links";

export type TrackFileMeta = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
};

export type CreateReleaseDraftState = {
  // identity / context (Telegram id как строка — совпадает с TEXT в БД и фильтрами)
  userId: string | null;
  telegramName: string | null;
  /** @username без @ из WebApp (может быть null). */
  telegramUsername: string | null;
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
  /** Serializable fallback for showing previously attached files in UI after rehydrate. */
  trackFilesMeta: (TrackFileMeta | null)[];
  /** URL аудио из БД после резюме черновика (подсказки UX; не заменяют File при отправке). */
  trackAudioUrlsFromDb: (string | null)[];
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
  setUserContext: (args: {
    userId: string | null;
    telegramName: string | null;
    telegramUsername?: string | null;
  }) => void;
  setReleaseId: (releaseId: string | null) => void;
  setClientRequestId: (clientRequestId: string | null) => void;

  setMetadata: (patch: Partial<CreateMetadata>) => void;
  setArtworkUrl: (url: string | null) => void;
  setArtworkFile: (file: File | null) => void;
  setTracks: (tracks: CreateTrack[]) => void;
  setTrackFile: (index: number, file: File | null) => void;
  clearTrackFile: (index: number) => void;
  syncTrackFilesLength: (len: number) => void;
  setTrackAudioUrlAt: (index: number, url: string | null) => void;
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

/**
 * Производное: все слоты треков имеют URL из БД/Storage — не дублируем отдельным флагом в стейте.
 */
export const selectTracksWavFullySynced = (s: CreateReleaseDraftStore): boolean => {
  const n = s.tracks.length;
  if (n === 0) return false;
  const urls = s.trackAudioUrlsFromDb;
  for (let i = 0; i < n; i += 1) {
    const u = urls[i];
    if (typeof u !== "string" || u.trim().length === 0) return false;
  }
  return true;
};

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
  label: FIXED_RELEASE_LABEL,
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

function normLyrics(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normFeaturingList(v: unknown): string {
  if (!Array.isArray(v)) return "[]";
  return JSON.stringify(v.map((x) => String(x).trim()));
}

function areTracksEqual(current: CreateTrack[], next: CreateTrack[]) {
  if (current.length !== next.length) return false;
  for (let i = 0; i < current.length; i += 1) {
    if (current[i]?.title !== next[i]?.title) return false;
    if (Boolean(current[i]?.explicit) !== Boolean(next[i]?.explicit)) return false;
    if (normLyrics(current[i]?.lyrics) !== normLyrics(next[i]?.lyrics)) return false;
    if (
      normFeaturingList(current[i]?.featuringArtistNames) !==
      normFeaturingList(next[i]?.featuringArtistNames)
    ) {
      return false;
    }
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

function areTrackFilesMetaEqualLengthAndValues(
  a: (TrackFileMeta | null)[],
  b: (TrackFileMeta | null)[]
): boolean {
  if (a.length !== b.length) return false;
  return a.every((m, i) => {
    const n = b[i];
    if (m === n) return true;
    if (!m || !n) return false;
    return (
      m.name === n.name &&
      m.size === n.size &&
      m.type === n.type &&
      m.lastModified === n.lastModified
    );
  });
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
  "tracks" | "trackFiles" | "trackFilesMeta" | "trackAudioUrlsFromDb"
> {
  const prev0 = state.tracks[0] ?? {
    title: "",
    explicit: false,
    lyrics: "",
    featuringArtistNames: []
  };
  const mergedFeat = unionFeaturingNamesFromTracks(state.tracks);
  const nextTracks: CreateTrack[] = [
    { ...prev0, title: nextMetadata.releaseTitle, featuringArtistNames: mergedFeat }
  ];
  const nextTrackFiles = state.trackFiles.slice(0, 1);
  while (nextTrackFiles.length < 1) nextTrackFiles.push(null);
  const nextTrackFilesMeta = state.trackFilesMeta.slice(0, 1);
  while (nextTrackFilesMeta.length < 1) nextTrackFilesMeta.push(null);
  const nextUrls = state.trackAudioUrlsFromDb.slice(0, 1);
  while (nextUrls.length < 1) nextUrls.push(null);
  return {
    tracks: nextTracks,
    trackFiles: nextTrackFiles,
    trackFilesMeta: nextTrackFilesMeta,
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
        telegramUsername: null,
        releaseId: null,
        clientRequestId: null,

        metadata: EMPTY_METADATA,
        artworkUrl: null,
        artworkFile: null,
        tracks: [{ title: "", explicit: false, lyrics: "", featuringArtistNames: [] }],
        trackFiles: [null],
        trackFilesMeta: [null],
        trackAudioUrlsFromDb: [],
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

        setUserContext: ({ userId, telegramName, telegramUsername }) =>
          set((state) => {
            const nextU = telegramUsername ?? null;
            if (
              state.userId === userId &&
              state.telegramName === telegramName &&
              state.telegramUsername === nextU
            ) {
              return state;
            }
            return { userId, telegramName, telegramUsername: nextU };
          }),
        setReleaseId: (releaseId) =>
          set((state) => (state.releaseId === releaseId ? state : { releaseId })),
        setClientRequestId: (clientRequestId) =>
          set((state) =>
            state.clientRequestId === clientRequestId ? state : { clientRequestId }
          ),

        setMetadata: (patch) =>
          set((state) => {
            const nextMetadata = { ...state.metadata, ...patch, label: FIXED_RELEASE_LABEL };

            let nextTracks = state.tracks;
            let nextTrackFiles = state.trackFiles;
            let nextTrackFilesMeta = state.trackFilesMeta;
            let nextUrls = state.trackAudioUrlsFromDb;

            if (nextMetadata.releaseType === "single") {
              const synced = syncStateForSingleRelease(state, nextMetadata);
              nextTracks = synced.tracks;
              nextTrackFiles = synced.trackFiles;
              nextTrackFilesMeta = synced.trackFilesMeta;
              nextUrls = synced.trackAudioUrlsFromDb;
            }

            const metadataSame = areMetadataEqual(state.metadata, nextMetadata);
            const tracksSame = areTracksEqual(state.tracks, nextTracks);
            const filesSame = areTrackFilesEqualLengthAndRefs(
              state.trackFiles,
              nextTrackFiles
            );
            const filesMetaSame = areTrackFilesMetaEqualLengthAndValues(
              state.trackFilesMeta,
              nextTrackFilesMeta
            );
            const urlsSame = areTrackUrlsEqualLengthAndValues(
              state.trackAudioUrlsFromDb,
              nextUrls
            );

            if (metadataSame && tracksSame && filesSame && filesMetaSame && urlsSame) {
              return state;
            }

            return {
              metadata: nextMetadata,
              tracks: nextTracks,
              trackFiles: nextTrackFiles,
              trackFilesMeta: nextTrackFilesMeta,
              trackAudioUrlsFromDb: nextUrls,
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
            const prevMeta = state.trackFilesMeta;
            const nextMeta = prevMeta.slice(0, tracks.length);
            while (nextMeta.length < tracks.length) nextMeta.push(null);
            return {
              tracks,
              trackAudioUrlsFromDb: nextUrls,
              trackFilesMeta: nextMeta,
              ...stamp()
            };
          }),
        setTrackFile: (index, file) =>
          set((state) => {
            const prev = state.trackFiles;
            const prevMeta = state.trackFilesMeta;
            const trackCount = state.tracks.length;
            const currentFile = prev[index] ?? null;
            const currentMeta = prevMeta[index] ?? null;
            const nextMetaItem = file
              ? {
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  lastModified: file.lastModified
                }
              : null;
            const sameMeta =
              (currentMeta == null && nextMetaItem == null) ||
              (currentMeta != null &&
                nextMetaItem != null &&
                currentMeta.name === nextMetaItem.name &&
                currentMeta.size === nextMetaItem.size &&
                currentMeta.type === nextMetaItem.type &&
                currentMeta.lastModified === nextMetaItem.lastModified);
            if (
              currentFile === file &&
              sameMeta &&
              prev.length >= trackCount &&
              prevMeta.length >= trackCount
            ) {
              return state;
            }
            const next = [...prev];
            const nextMeta = [...prevMeta];
            while (next.length < trackCount) next.push(null);
            while (nextMeta.length < trackCount) nextMeta.push(null);
            next[index] = file;
            nextMeta[index] = nextMetaItem;
            return {
              trackFiles: next,
              trackFilesMeta: nextMeta
            };
          }),
        clearTrackFile: (index) =>
          set((state) => {
            const trackCount = state.tracks.length;
            const nextFiles = [...state.trackFiles];
            const nextMeta = [...state.trackFilesMeta];
            while (nextFiles.length < trackCount) nextFiles.push(null);
            while (nextMeta.length < trackCount) nextMeta.push(null);
            if (nextFiles[index] == null && nextMeta[index] == null) return state;
            nextFiles[index] = null;
            nextMeta[index] = null;
            return { trackFiles: nextFiles, trackFilesMeta: nextMeta };
          }),
        setTrackAudioUrlAt: (index, url) =>
          set((state) => {
            const next = [...state.trackAudioUrlsFromDb];
            while (next.length <= index) next.push(null);
            if (next[index] === url) return state;
            next[index] = url;
            return { trackAudioUrlsFromDb: next, ...stamp() };
          }),
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
            const prevFiles = state.trackFiles;
            const prevMeta = state.trackFilesMeta;
            if (prevFiles.length === len && prevMeta.length === len) return state;
            const nextFiles = prevFiles.slice(0, len);
            while (nextFiles.length < len) nextFiles.push(null);
            const nextMeta = prevMeta.slice(0, len);
            while (nextMeta.length < len) nextMeta.push(null);
            return { trackFiles: nextFiles, trackFilesMeta: nextMeta };
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
            tracks: [{ title: "", explicit: false, lyrics: "", featuringArtistNames: [] }],
            trackFiles: [null],
            trackFilesMeta: [null],
            trackAudioUrlsFromDb: [],
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
            tracks: [{ title: "", explicit: false, lyrics: "", featuringArtistNames: [] }],
            trackFiles: [null],
            trackFilesMeta: [null],
            trackAudioUrlsFromDb: [],
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
            tracks: [{ title: "", explicit: false, lyrics: "", featuringArtistNames: [] }],
            trackFiles: [null],
            trackFilesMeta: [null],
            trackAudioUrlsFromDb: [],
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

            let tracks: CreateTrack[] = payload.tracks.map((t) => ({
              ...t,
              featuringArtistNames: t.featuringArtistNames ?? []
            }));
            let len = tracks.length;

            if (isSingle) {
              const first = tracks[0] ?? {
                title: "",
                explicit: false,
                lyrics: "",
                featuringArtistNames: []
              };
              const mergedFeat = unionFeaturingNamesFromTracks(tracks);
              tracks = [
                {
                  ...first,
                  title: payload.metadata.releaseTitle,
                  featuringArtistNames: mergedFeat
                }
              ];
              len = 1;
            }

            const trackFiles: (File | null)[] = [];
            for (let i = 0; i < len; i += 1) trackFiles.push(null);
            const trackFilesMeta: (TrackFileMeta | null)[] = [];
            for (let i = 0; i < len; i += 1) trackFilesMeta.push(null);

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
              metadata: { ...payload.metadata, label: FIXED_RELEASE_LABEL },
              artworkUrl: payload.artworkUrl,
              tracks,
              artworkFile: null,
              trackFiles,
              trackFilesMeta,
              trackAudioUrlsFromDb,
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
        const p = { ...(persistedState ?? {}) } as Partial<CreateReleaseDraftState> & {
          tracksWavSyncedToDb?: boolean;
        };
        delete p.tracksWavSyncedToDb;
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
        if (rawMeta && typeof rawMeta === "object") {
          const rt = String(mergedMeta.releaseTitle ?? "").trim();
          if (!rt) {
            const legacyTitle =
              (typeof rawMeta.title === "string" ? rawMeta.title : "") ||
              (typeof rawMeta.track_name === "string" ? rawMeta.track_name : "");
            const t = String(legacyTitle).trim();
            if (t) mergedMeta = { ...mergedMeta, releaseTitle: t };
          }
        }
        mergedMeta = { ...mergedMeta, label: FIXED_RELEASE_LABEL };
        const mergedLinks =
          p.releaseArtistLinks != null
            ? { ...EMPTY_ARTIST_LINKS, ...p.releaseArtistLinks }
            : currentState.releaseArtistLinks;

        let mergedTracks =
          Array.isArray(p.tracks) && p.tracks.length > 0 ? p.tracks : currentState.tracks;
        mergedTracks = mergedTracks.map((t) => ({
          ...t,
          featuringArtistNames: (t as CreateTrack).featuringArtistNames ?? []
        }));
        const legacyFeat = Array.isArray(
          (p as { featuringArtistNames?: unknown }).featuringArtistNames
        )
          ? (p as { featuringArtistNames: unknown[] }).featuringArtistNames.map((n) => String(n))
          : [];
        if (legacyFeat.some((n) => n.trim().length > 0)) {
          mergedTracks = mergedTracks.map((t, i) => {
            const cur = (t as CreateTrack).featuringArtistNames ?? [];
            if (i === 0 && cur.length === 0) {
              return { ...t, featuringArtistNames: legacyFeat };
            }
            return t;
          });
        }

        const { featuringArtistNames: _legacyFeatKey, ...persistSansLegacy } = p as Record<
          string,
          unknown
        >;

        return {
          ...currentState,
          ...persistSansLegacy,
          metadata: mergedMeta,
          releaseArtistLinks: mergedLinks,
          tracks: mergedTracks,
          trackFilesMeta: Array.isArray(p.trackFilesMeta)
            ? p.trackFilesMeta.slice(0, mergedTracks.length).map((item) => {
                if (!item || typeof item !== "object") return null;
                const meta = item as Partial<TrackFileMeta>;
                if (
                  typeof meta.name !== "string" ||
                  typeof meta.size !== "number" ||
                  typeof meta.type !== "string" ||
                  typeof meta.lastModified !== "number"
                ) {
                  return null;
                }
                return {
                  name: meta.name,
                  size: meta.size,
                  type: meta.type,
                  lastModified: meta.lastModified
                } satisfies TrackFileMeta;
              })
            : currentState.trackFilesMeta
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
        trackFilesMeta: state.trackFilesMeta,
        trackAudioUrlsFromDb: state.trackAudioUrlsFromDb,
        releaseArtistLinks: state.releaseArtistLinks,
        lastModified: state.lastModified,
        successSummary: state.successSummary
      })
    }
  )
);
