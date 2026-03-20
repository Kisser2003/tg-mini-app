import { formatErrorMessage } from "@/lib/errors";
import { getUploadErrorDetails, logClientError } from "@/lib/logger";
import { getExpectedAdminTelegramId } from "@/lib/admin";
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
  ensureReleaseProcessing,
  getReleaseById,
  getReleaseTracksByReleaseId,
  submitRelease,
  updateRelease,
  uploadReleaseArtwork,
  uploadReleaseTrackAudio
} from "@/repositories/releases.repo";
import type { ReleaseRecord, ReleaseStep1Payload, ReleaseTrackRow } from "@/repositories/releases.repo";
import type { CreateMetadata, CreateTrack } from "./types";
import { isAssetsComplete, isMetadataComplete, isTracksComplete, metadataSchema, tracksSchema } from "./schemas";
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

/** Паспорт релиза из строки `releases` (общий маппинг для hydrate и резюме черновика). */
export function createMetadataFromReleaseRecord(existing: ReleaseRecord): CreateMetadata {
  return {
    artists: [{ name: existing.artist_name, role: "primary" }],
    releaseTitle: existing.track_name,
    releaseType: existing.release_type,
    genre: existing.genre,
    subgenre: "",
    language: "",
    label: existing.artist_name,
    releaseDate: existing.release_date,
    explicit: Boolean(existing.explicit)
  };
}

function buildTracksForResume(release: ReleaseRecord, rows: ReleaseTrackRow[]): CreateTrack[] {
  if (rows.length > 0) {
    return rows.map((r) => ({
      title: r.title,
      explicit: Boolean(r.explicit)
    }));
  }
  if (release.release_type === "single") {
    return [{ title: release.track_name, explicit: Boolean(release.explicit) }];
  }
  return [
    { title: "", explicit: false },
    { title: "", explicit: false }
  ];
}

/** URL аудио из БД, по индексу трека (для подсказок после резюме). */
function buildTrackAudioUrlsFromDb(
  release: ReleaseRecord,
  rows: ReleaseTrackRow[],
  tracks: CreateTrack[]
): (string | null)[] {
  const len = tracks.length;
  const out: (string | null)[] = Array.from({ length: len }, () => null);
  if (rows.length > 0) {
    for (const r of rows) {
      if (r.index >= 0 && r.index < len) {
        out[r.index] = r.audio_url ?? null;
      }
    }
    return out;
  }
  if (len === 1 && release.audio_url) {
    out[0] = release.audio_url;
  }
  return out;
}

/**
 * Следующий шаг мастера после резюме (как в useStepGuard): паспорт → обложка → треки → проверка.
 */
export function getResumeCreatePath(args: {
  metadata: CreateMetadata;
  artworkUrl: string | null;
  tracks: CreateTrack[];
}): "/create/metadata" | "/create/assets" | "/create/tracks" | "/create/review" {
  const { metadata, artworkUrl, tracks } = args;
  if (!isMetadataComplete(metadata)) return "/create/metadata";
  if (!isAssetsComplete({ artworkUrl })) return "/create/assets";
  if (!isTracksComplete({ tracks }, metadata.releaseType)) return "/create/tracks";
  return "/create/review";
}

/**
 * Загрузить черновик с сервера в стор и вернуть путь для router.push.
 * При ошибке пишет в submitError и возвращает null.
 */
export async function resumeDraftFromRelease(releaseId: string): Promise<string | null> {
  try {
    initUserContextInStore();
    const existing = await getReleaseById(releaseId);

    if (existing.status !== "draft") {
      useCreateReleaseDraftStore
        .getState()
        .setSubmitError("Продолжить можно только черновик.");
      return null;
    }

    const store = useCreateReleaseDraftStore.getState();
    const uid = store.userId;
    if (uid != null) {
      const ownerId = Number(existing.user_id);
      const sessionId = Number(uid);
      const isOwner =
        Number.isFinite(ownerId) &&
        Number.isFinite(sessionId) &&
        ownerId === sessionId;
      const isAdminUser = sessionId === getExpectedAdminTelegramId();
      if (!isOwner && !isAdminUser) {
        useCreateReleaseDraftStore.getState().setSubmitError("Это не ваш релиз.");
        return null;
      }
    }

    const trackRows = await getReleaseTracksByReleaseId(releaseId);
    const metadata = createMetadataFromReleaseRecord(existing);
    metadataSchema.parse(metadata);
    const tracks = buildTracksForResume(existing, trackRows);
    const trackAudioUrlsFromDb = buildTrackAudioUrlsFromDb(existing, trackRows, tracks);

    store.resumeFromDraft({
      releaseId: existing.id,
      clientRequestId: existing.client_request_id ?? null,
      metadata,
      artworkUrl: existing.artwork_url ?? null,
      tracks,
      trackAudioUrlsFromDb
    });

    const next = getResumeCreatePath({
      metadata,
      artworkUrl: existing.artwork_url ?? null,
      tracks
    });
    return next;
  } catch (e: unknown) {
    useCreateReleaseDraftStore
      .getState()
      .setSubmitError(formatErrorMessage(e, "Не удалось открыть черновик."));
    return null;
  }
}

export async function hydrateFromReleaseId(releaseId: string): Promise<void> {
  try {
    initUserContextInStore();
    const existing = await getReleaseById(releaseId);
    const store = useCreateReleaseDraftStore.getState();
    const uid = store.userId;
    if (uid != null) {
      const ownerId = Number(existing.user_id);
      const sessionId = Number(uid);
      const isOwner =
        Number.isFinite(ownerId) &&
        Number.isFinite(sessionId) &&
        ownerId === sessionId;
      const isAdminUser = sessionId === getExpectedAdminTelegramId();
      if (!isOwner && !isAdminUser) {
        useCreateReleaseDraftStore.getState().setSubmitError("Это не ваш релиз.");
        return;
      }
    }
    const metadata = createMetadataFromReleaseRecord(existing);
    metadataSchema.parse(metadata);

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
    const msg =
      parsed.error.issues[0]?.message ?? "Заполните паспорт релиза корректно.";
    store.setSubmitError(msg);
    return null;
  }

  if (store.releaseId) {
    try {
      const row = await getReleaseById(store.releaseId);
      if (row.status === "processing" || row.status === "ready") {
        store.setSubmitError("Этот релиз уже отправлен на проверку.");
        return null;
      }
    } catch {
      // ignore — продолжаем создание черновика при ошибке загрузки
    }
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
    logClientError({
      error: e,
      screenName: "CreateRelease_ensureDraft",
      route: "/create/assets",
      extra: { step: "ensureDraftRelease" }
    });
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
    store.setSubmitError(`Ошибка загрузки обложки: ${detail}`);
    const up = getUploadErrorDetails(e);
    logClientError({
      error: e,
      screenName: "CreateRelease_uploadArtwork",
      route: "/create/assets",
      extra: { step: "uploadArtworkForDraft", ...up }
    });
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
    const msg =
      parsedTracks.error.issues[0]?.message ?? "Проверьте данные треков.";
    store.setSubmitError(msg);
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

  let uploadPhase:
    | "preparing"
    | "db_artwork_url"
    | "storage_track_wav"
    | "db_release_track"
    | "finalizing_submit" = "preparing";
  let uploadTrackIndex: number | null = null;

  try {
    try {
      uploadPhase = "preparing";
      const existing = await getReleaseById(releaseId);
      if (existing.status === "failed") {
        await updateRelease(releaseId, { status: "draft", error_message: null });
      }

      if (store.artworkUrl) {
        uploadPhase = "db_artwork_url";
        await updateRelease(releaseId, { artwork_url: store.artworkUrl });
        store.setSubmitProgress(15);
      }

      for (let index = 0; index < parsedTracks.data.tracks.length; index += 1) {
        uploadTrackIndex = index;
        store.setSubmitStage("uploading_tracks");
        const track = parsedTracks.data.tracks[index];
        const file = args.files[index];
        uploadPhase = "storage_track_wav";
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
        uploadPhase = "db_release_track";
        await addReleaseTrack({
          releaseId,
          index,
          title: track.title,
          explicit: Boolean(track.explicit),
          audioUrl
        });
        setTrackUploadProgress(index + 1, 0);
      }
      uploadTrackIndex = null;
    } catch (e: unknown) {
      const up = getUploadErrorDetails(e);
      logClientError({
        error: e,
        screenName: "CreateReview_submitUpload",
        route: "/create/review",
        extra: {
          flow: "submitTracksAndFinalize",
          uploadPhase,
          trackIndex: uploadTrackIndex,
          httpStatus: up.httpStatus,
          supabaseStorageHint: up.supabaseHint
        }
      });
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

      useCreateReleaseDraftStore.getState().setSubmitStatus("error");
      useCreateReleaseDraftStore.getState().setSubmitStage("error");
      const detail = e instanceof Error ? e.message : JSON.stringify(e);

      const primary =
        existingMessage && existingMessage.length > 0
          ? existingMessage
          : `Ошибка отправки: ${detail}`;

      useCreateReleaseDraftStore.getState().setSubmitError(
        cleanupFailed
          ? `${primary}. Автоочистка завершилась с ошибкой — обратитесь к администратору.`
          : `${primary}. Временные файлы очищены, можно повторить отправку.`
      );
      return false;
    }

    try {
      uploadPhase = "finalizing_submit";
      const storeAfterUpload = useCreateReleaseDraftStore.getState();
      storeAfterUpload.setSubmitStage("finalizing");
      storeAfterUpload.setSubmitProgress(92);

      await submitRelease({ releaseId, clientRequestId });

      const verified = await ensureReleaseProcessing(releaseId, clientRequestId);

      if (process.env.NODE_ENV === "development") {
        if (verified.status !== "processing" && verified.status !== "ready") {
          console.warn(
            "[submitTracksAndFinalize] unexpected status after ensure:",
            verified.status
          );
        }
      }

      const storeOk = useCreateReleaseDraftStore.getState();
      storeOk.setSubmitStatus("success");
      storeOk.setSubmitStage("done");
      storeOk.setSubmitProgress(100);
      const title = verified.track_name?.trim() || "Релиз";
      storeOk.setSuccessSummary({
        artistName: verified.artist_name?.trim() || "Артист",
        trackName: title,
        releaseName: title
      });
      // Очистить мастер только после подтверждённого статуса в БД; successSummary для /create/success.
      // Состояние submit (прогресс 100%) сохраняем для exit-анимации на Review — см. clearCreateFormKeepSummaryPreserveSubmit.
      storeOk.clearCreateFormKeepSummaryPreserveSubmit();
      try {
        triggerHaptic("success");
      } catch {}
      return true;
    } catch (e: unknown) {
      logClientError({
        error: e,
        screenName: "CreateReview_submitFinalize",
        route: "/create/review",
        extra: { flow: "submitTracksAndFinalize", uploadPhase: "finalizing_submit" }
      });
      const storeFail = useCreateReleaseDraftStore.getState();
      storeFail.setSubmitStatus("error");
      storeFail.setSubmitStage("error");
      const detail = e instanceof Error ? e.message : JSON.stringify(e);
      storeFail.setSubmitError(
        detail.includes("Не удалось отправить релиз на модерацию")
          ? detail
          : `Ошибка отправки: ${detail}`
      );
      return false;
    }
  } finally {
    submitTracksInFlight = false;
  }
}

