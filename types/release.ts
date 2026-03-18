export type ReleaseType = "SINGLE" | "EP" | "ALBUM";

export type TrackVersion =
  | "Оригинал"
  | "Ремикс"
  | "Инструментал"
  | "Радио-версия";

export type UploadStatus = "idle" | "uploading" | "done";

export type ReleaseTrack = {
  id: string;
  title: string;
  audio_file: string | null;
  version: TrackVersion;
  explicit: boolean;
  isrc?: string;
  contributing_artists: string[];
  uploadStatus: UploadStatus;
  uploadProgress: number;
};

export type ReleaseDraft = {
  releaseType: ReleaseType;
  releaseTitle: string;
  primaryArtist: string;
  featuringArtists: string[];
  genre: string;
  releaseDate: string;
  artwork: string | null;
  tracks: ReleaseTrack[];
};

export type ModerationQueueItem = {
  id: string;
  title: string;
  artist: string;
  submittedAt: string;
  genre: string;
  coverUrl: string;
};
