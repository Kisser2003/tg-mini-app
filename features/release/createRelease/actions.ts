import { formatErrorMessage } from "@/lib/errors";
import {
  getTelegramUserDisplayName,
  getTelegramUserId,
  getTelegramWebApp,
  initTelegramWebApp,
  triggerHaptic
} from "@/lib/telegram";
import {
  addReleaseTrack,
  cleanupReleaseTracks,
  createDraftRelease,
  deleteReleaseFiles,
  getReleaseById,
  submitRelease,
  updateRelease,
  uploadReleaseArtwork,
  uploadReleaseTrackAudio
} from "@/repositories/releases.repo";
import type { ReleaseRecord, ReleaseStep1Payload } from "@/repositories/releases.repo";
import { metadataSchema, tracksSchema } from "./schemas";
import { useCreateReleaseDraftStore } from "./store";

/** Защита от двойного сабмита (двойной тап в Telegram). */
let submitTracksInFlight = false;

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
  const store = useCreateReleaseDraftStore.getState();
  const previousUserId = store.userId;
  if (
    previousUserId != null &&
    userId != null &&
    previousUserId !== userId
  ) {
    store.resetDraft();
  }
  store.setUserContext({ userId, telegramName });
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
      triggerHaptic("success");
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
      file,
      options: {
        markReleaseFailedOnError: { releaseId: store.releaseId }
      }
    });
    store.setArtworkUrl(artworkUrl);
    try {
      triggerHaptic("success");
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

  if (submitTracksInFlight) {
    store.setSubmitError("Отправка уже выполняется. Дождитесь завершения.");
    return false;
  }

  store.setSubmitStage("idle");
  store.setSubmitProgress(0);
  if (!store.userId || !store.releaseId) {
    store.setSubmitError("Нет данных релиза для отправки.");
    return false;
  }

  if (!store.clientRequestId) {
    store.setSubmitError("Нет client_request_id. Сохраните паспорт релиза (шаг «Паспорт») и повторите.");
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

  submitTracksInFlight = true;
  store.setSubmitStatus("submitting");
  store.setSubmitStage("preparing");
  store.setSubmitProgress(5);
  store.setSubmitError(null);

  const totalTracks = parsedTracks.data.tracks.length;
  const releaseId = store.releaseId;
  const clientRequestId = store.clientRequestId;

  const setTrackUploadProgress = (trackIndex: number, filePercent: number) => {
    const segment = (trackIndex + filePercent / 100) / Math.max(totalTracks, 1);
    store.setSubmitProgress(15 + segment * 70);
  };

  try {
    const existing = await getReleaseById(releaseId);
    if (existing.status === "failed") {
      await updateRelease(releaseId, { status: "draft", error_message: null });
    }

    if (store.artworkUrl) {
      await updateRelease(releaseId, { artwork_url: store.artworkUrl });
      store.setSubmitProgress(15);
    }

    for (let index = 0; index < parsedTracks.data.tracks.length; index += 1) {
      store.setSubmitStage("uploading_tracks");
      const track = parsedTracks.data.tracks[index];
      const file = args.files[index];
      const audioUrl = await uploadReleaseTrackAudio({
        userId: store.userId,
        releaseId,
        trackIndex: index,
        file,
        options: {
          markReleaseFailedOnError: { releaseId },
          onProgress: (pct) => setTrackUploadProgress(index, pct)
        }
      });
      await addReleaseTrack({
        releaseId,
        index,
        title: track.title,
        explicit: Boolean(track.explicit),
        audioUrl
      });
      setTrackUploadProgress(index + 1, 0);
    }

    store.setSubmitStage("finalizing");
    store.setSubmitProgress(92);
    const updated = await submitRelease({ releaseId, clientRequestId });
    store.setSubmitStatus("success");
    store.setSubmitStage("done");
    store.setSubmitProgress(100);
    store.setSuccessSummary({
      artistName: updated.artist_name,
      trackName: updated.track_name
    });
    store.clearCreateFormKeepSummary();
    try {
      triggerHaptic("success");
    } catch {}
    return true;
  } catch (e: unknown) {
    let cleanupFailed = false;
    let existingMessage: string | null = null;
    try {
      const current = await getReleaseById(releaseId).catch(() => null);
      existingMessage = current?.error_message?.trim() ?? null;

      await cleanupReleaseTracks(releaseId);
      await deleteReleaseFiles({
        userId: store.userId,
        releaseId,
        trackCount: parsedTracks.data.tracks.length
      });

      if (!current || current.status !== "failed") {
        await updateRelease(releaseId, {
          status: "failed",
          error_message: "Отправка прервана, временные файлы очищены."
        });
      }
    } catch {
      cleanupFailed = true;
    }

    store.setSubmitStatus("error");
    store.setSubmitStage("error");
    const detail = e instanceof Error ? e.message : JSON.stringify(e);

    const primary =
      existingMessage && existingMessage.length > 0
        ? existingMessage
        : `Ошибка отправки: ${detail}`;

    store.setSubmitError(
      cleanupFailed
        ? `${primary}. Автоочистка завершилась с ошибкой — обратитесь к администратору.`
        : `${primary}. Временные файлы очищены, можно повторить отправку.`
    );
    return false;
  } finally {
    submitTracksInFlight = false;
  }
}

