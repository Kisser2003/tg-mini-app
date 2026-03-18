import { formatErrorMessage } from "@/lib/errors";
import {
  getTelegramUserDisplayName,
  getTelegramUserId,
  getTelegramWebApp,
  initTelegramWebApp
} from "@/lib/telegram";
import {
  addReleaseTrack,
  createDraftRelease,
  getReleaseById,
  submitRelease,
  updateRelease,
  uploadReleaseArtwork,
  uploadReleaseTrackAudio
} from "@/repositories/releases.repo";
import type { ReleaseRecord, ReleaseStep1Payload } from "@/repositories/releases.repo";
import { metadataSchema, tracksSchema } from "./schemas";
import { useCreateReleaseDraftStore } from "./store";

function uuidV4Fallback(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
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
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return uuidV4Fallback();
}

function getDevUserIdOverride(): number | null {
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
  if (process.env.NODE_ENV === "production") return null;
  if (typeof window === "undefined") return null;
  const hasTelegram = Boolean(getTelegramWebApp()?.initDataUnsafe?.user?.id);
  if (hasTelegram) return null;
  return 1;
}

export function initUserContextInStore() {
  initTelegramWebApp();
  const devUserId = getDevUserIdOverride() ?? getDevUserIdDefault();
  const userId = devUserId ?? getTelegramUserId() ?? null;
  const telegramName = getTelegramUserDisplayName();
  useCreateReleaseDraftStore.getState().setUserContext({ userId, telegramName });
}

export async function hydrateFromReleaseId(releaseId: string): Promise<void> {
  try {
    initUserContextInStore();
    const existing = await getReleaseById(releaseId);
    const metadata = {
      artists: [{ name: existing.artist_name, role: "primary" as const }],
      releaseTitle: existing.track_name,
      releaseType: existing.release_type as any,
      genre: existing.genre,
      subgenre: "",
      language: "",
      label: existing.artist_name,
      releaseDate: existing.release_date,
      explicit: Boolean(existing.explicit)
    };
    metadataSchema.parse(metadata);

    const store = useCreateReleaseDraftStore.getState();
    store.setReleaseId(existing.id);
    store.setClientRequestId(existing.client_request_id ?? null);
    store.setMetadata(metadata);
    store.setArtworkUrl(existing.artwork_url ?? null);
    store.setSubmitError(null);
  } catch (e: unknown) {
    useCreateReleaseDraftStore
      .getState()
      .setSubmitError(formatErrorMessage(e, "Не удалось загрузить релиз для редактирования."));
  }
}

export async function ensureDraftRelease(): Promise<ReleaseRecord | null> {
  const store = useCreateReleaseDraftStore.getState();
  initUserContextInStore();

  const parsed = metadataSchema.safeParse(store.metadata);
  if (!parsed.success) {
    store.setSubmitError("Заполните паспорт релиза корректно.");
    return null;
  }

  const mainArtistName = parsed.data.artists[0]?.name ?? "";
  const effectiveUserId = store.userId ?? 0;
  const clientRequestId = createClientRequestId(store.clientRequestId);

  const payload: ReleaseStep1Payload = {
    user_id: effectiveUserId,
    client_request_id: clientRequestId,
    artist_name: mainArtistName,
    track_name: parsed.data.releaseTitle,
    release_type: parsed.data.releaseType,
    genre: parsed.data.genre,
    release_date: parsed.data.releaseDate,
    explicit: Boolean(parsed.data.explicit)
  };

  try {
    store.setSubmitError(null);
    const draft = await createDraftRelease(payload);
    store.setReleaseId(draft.id);
    store.setClientRequestId(clientRequestId);
    try {
      getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.("success");
    } catch {}
    return draft;
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : JSON.stringify(e);
    store.setSubmitError(`Ошибка черновика: ${detail}`);
    return null;
  }
}

export async function uploadArtworkForDraft(file: File): Promise<string | null> {
  const store = useCreateReleaseDraftStore.getState();
  initUserContextInStore();
  if (!store.userId || !store.releaseId) {
    store.setSubmitError("Нет данных релиза для загрузки обложки.");
    return null;
  }
  try {
    store.setSubmitError(null);
    const artworkUrl = await uploadReleaseArtwork({
      userId: store.userId,
      releaseId: store.releaseId,
      file
    });
    store.setArtworkUrl(artworkUrl);
    try {
      getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.("success");
    } catch {}
    return artworkUrl;
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : JSON.stringify(e);
    store.setSubmitError(`Ошибка загрузки: ${detail}`);
    return null;
  }
}

export async function submitTracksAndFinalize(args: { files: File[] }): Promise<boolean> {
  const store = useCreateReleaseDraftStore.getState();
  initUserContextInStore();
  if (!store.userId || !store.releaseId) {
    store.setSubmitError("Нет данных релиза для отправки.");
    return false;
  }

  const parsedTracks = tracksSchema.safeParse({ tracks: store.tracks });
  if (!parsedTracks.success) {
    store.setSubmitError("Проверьте данные треков.");
    return false;
  }

  if (args.files.length !== parsedTracks.data.tracks.length) {
    store.setSubmitError("Загрузите WAV для каждого трека.");
    return false;
  }

  store.setSubmitStatus("submitting");
  store.setSubmitError(null);

  try {
    if (store.artworkUrl) {
      await updateRelease(store.releaseId, { artwork_url: store.artworkUrl });
    }

    for (let index = 0; index < parsedTracks.data.tracks.length; index += 1) {
      const track = parsedTracks.data.tracks[index];
      const file = args.files[index];
      const audioUrl = await uploadReleaseTrackAudio({
        userId: store.userId,
        releaseId: store.releaseId,
        trackIndex: index,
        file
      });
      await addReleaseTrack({
        releaseId: store.releaseId,
        index,
        title: track.title,
        explicit: Boolean(track.explicit),
        audioUrl
      });
    }

    const updated = await submitRelease(store.releaseId);
    store.setSubmitStatus("success");
    store.setSuccessSummary({
      artistName: updated.artist_name,
      trackName: updated.track_name
    });
    try {
      getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.("success");
    } catch {}
    return true;
  } catch (e: unknown) {
    store.setSubmitStatus("error");
    const detail = e instanceof Error ? e.message : JSON.stringify(e);
    store.setSubmitError(`Ошибка отправки: ${detail}`);
    return false;
  }
}

