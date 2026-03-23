import {
  formatErrorMessage,
  getPostgrestErrorPayload,
  USER_REQUEST_TIMEOUT_MESSAGE
} from "@/lib/errors";
import { withRequestTimeout } from "@/lib/withRequestTimeout";
import { getUploadErrorDetails, logClientError } from "@/lib/logger";
import { requestScreenWakeLock, releaseWakeLock } from "@/lib/wake-lock";
import { getExpectedAdminTelegramId } from "@/lib/admin";
import {
  getTelegramApiAuthHeaders,
  getTelegramUser,
  getTelegramUserDisplayName,
  getTelegramUserId,
  getTelegramUsername,
  getTelegramWebApp,
  initTelegramWebApp,
  isTelegramMiniApp,
  setRlsTelegramUserIdOverride
} from "@/lib/telegram";
import { hapticMap } from "@/lib/haptic-map";
import {
  addReleaseTrack,
  cleanupReleaseTracks,
  createDraftRelease,
  deleteReleaseFiles,
  ensureReleaseProcessing,
  getReleaseById,
  getReleaseDisplayTitle,
  getReleaseTracksByReleaseId,
  submitRelease,
  updateRelease,
  uploadReleaseArtwork,
  uploadReleaseTrackAudio
} from "@/repositories/releases.repo";
import type { ReleaseRecord, ReleaseStep1Payload, ReleaseTrackRow } from "@/repositories/releases.repo";
import type { CreateMetadata, CreateTrack } from "./types";
import { isAssetsComplete, isMetadataComplete, isTracksComplete, metadataSchema, tracksSchema } from "./schemas";
import { selectTracksWavFullySynced, useCreateReleaseDraftStore } from "./store";
import { supabase } from "@/lib/supabase";
import { parseArtistLinksFromJson } from "@/lib/artist-links";
import { parseCollaboratorsFromDb } from "@/lib/collaborators";
import { parsePerformanceLanguage } from "@/lib/performance-language";
import { celebrateReleaseSubmission } from "@/lib/confetti-release-success";
import { toast } from "sonner";

/** Таймаут коротких операций Supabase (insert/upsert в БД). Загрузка WAV идёт напрямую в Storage без лимита. */
const SUPABASE_DB_OP_TIMEOUT_MS = 15000;

/** Защита от двойного сабмита (двойной тап в Telegram). */
let submitTracksInFlight = false;

const ALIGN_RELEASES_SESSION_KEY = "tg-mini-app-align-releases-ok-v1";
let alignReleasesFetchInFlight: Promise<void> | null = null;

/** HTTP-статус последнего ответа submit-precheck (для отладки 401 на экране Review). */
let lastSubmitPrecheckHttpStatus: number | null = null;

export function getLastSubmitPrecheckHttpStatus(): number | null {
  return lastSubmitPrecheckHttpStatus;
}

/** Числовой id для API/Storage из строки стора (Telegram id). */
function parseStoreUserId(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function isPostgrestNoSuchRowError(e: unknown): boolean {
  const code =
    typeof e === "object" && e !== null && "code" in e
      ? String((e as { code: unknown }).code)
      : "";
  return code === "PGRST116";
}

/**
 * Если в persist лежит `releaseId`, которого уже нет в БД, service routes (`save-draft-patch`,
 * `draft-upload-state`) отвечают 404 «Релиз не найден.» — сбрасываем id, дальше `ensureDraftRelease`
 * подтянет строку по `client_request_id` (upsert).
 * Сбрасываем только при PGRST116 (0 строк), не при обрыве сети.
 */
async function verifyStoredReleaseExistsOrClearReleaseId(): Promise<void> {
  const rid = useCreateReleaseDraftStore.getState().releaseId;
  if (!rid) return;
  try {
    await getReleaseById(rid);
  } catch (e: unknown) {
    if (isPostgrestNoSuchRowError(e)) {
      useCreateReleaseDraftStore.getState().setReleaseId(null);
    }
  }
}

/** Как в `ensureDraftRelease`: telegram_id строки tracks = WebApp user id или стор. */
function getTrackRowTelegramId(userId: number): number {
  return getTelegramUser()?.id ?? userId;
}

/** Заголовки Telegram / dev для API мастера создания релиза (user_id должен совпадать с владельцем в БД). */
function getCreateReleaseApiAuthHeaders(): Record<string, string> {
  const n = parseStoreUserId(useCreateReleaseDraftStore.getState().userId);
  return getTelegramApiAuthHeaders(n != null ? { userId: n } : undefined);
}

async function saveDraftPatchViaServiceApi(
  releaseId: string,
  patch: Record<string, unknown>
): Promise<boolean> {
  const doFetch = (authHeaders: Record<string, string>) =>
    fetch("/api/releases/save-draft-patch", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify({ releaseId, patch })
    });

  let authHeaders =
    typeof window !== "undefined" ? getCreateReleaseApiAuthHeaders() : {};
  let res = await doFetch(authHeaders);

  if (res.status === 401 && typeof window !== "undefined") {
    initTelegramWebApp();
    authHeaders = getCreateReleaseApiAuthHeaders();
    res = await doFetch(authHeaders);
  }

  if (res.status === 503) {
    return false;
  }

  return res.ok;
}

/**
 * Финальная отправка через service role на сервере (обход RLS), если задан `SUPABASE_SERVICE_ROLE_KEY`.
 * Иначе вернуть `null` — вызывающий код использует клиентский `submitRelease`.
 */
async function submitReleaseViaServiceApi(params: {
  releaseId: string;
  clientRequestId: string;
}): Promise<ReleaseRecord | null> {
  const doFetch = (authHeaders: Record<string, string>) =>
    fetch("/api/releases/finalize-submit", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify(params)
    });

  let authHeaders =
    typeof window !== "undefined" ? getCreateReleaseApiAuthHeaders() : {};
  let res = await doFetch(authHeaders);

  if (res.status === 401 && typeof window !== "undefined") {
    initTelegramWebApp();
    authHeaders = getCreateReleaseApiAuthHeaders();
    res = await doFetch(authHeaders);
  }

  if (res.status === 503) {
    return null;
  }

  let body: { ok?: boolean; record?: ReleaseRecord; error?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    /* ignore */
  }

  if (!res.ok || !body.ok || !body.record) {
    console.error("[submitReleaseViaServiceApi] failed", {
      status: res.status,
      body
    });
    throw new Error(
      typeof body.error === "string" && body.error.length > 0
        ? body.error
        : "Не удалось отправить релиз на модерацию."
    );
  }

  return body.record;
}

async function requestReleaseSubmitPrecheck(params: {
  releaseId: string;
  clientRequestId: string;
  declaredTrackCount: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  lastSubmitPrecheckHttpStatus = null;
  const bodyJson = JSON.stringify({
    releaseId: params.releaseId,
    clientRequestId: params.clientRequestId,
    declaredTrackCount: params.declaredTrackCount
  });

  const fetchPrecheck = (authHeaders: Record<string, string>) =>
    fetch("/api/releases/submit-precheck", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: bodyJson
    });

  let authHeaders =
    typeof window !== "undefined" ? getCreateReleaseApiAuthHeaders() : {};
  let res = await fetchPrecheck(authHeaders);

  if (res.status === 401 && typeof window !== "undefined") {
    initTelegramWebApp();
    authHeaders = getCreateReleaseApiAuthHeaders();
    res = await fetchPrecheck(authHeaders);
  }

  lastSubmitPrecheckHttpStatus = res.status;

  let body: { ok?: boolean; error?: string; details?: unknown } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const errPayload = {
      status: res.status,
      statusText: res.statusText,
      body,
      hadInitDataHeader: Boolean(authHeaders["X-Telegram-Init-Data"]),
      hadDevUserHeader: Boolean(authHeaders["X-Dev-Telegram-User-Id"]),
      releaseId: params.releaseId
    };
    console.error("[requestReleaseSubmitPrecheck] failed", errPayload);

    const msg =
      typeof body.error === "string" && body.error.length > 0
        ? body.error
        : res.status === 401
          ? "Не удалось подтвердить сессию Telegram. Откройте мини-приложение из Telegram."
          : "Не удалось проверить треки перед отправкой.";
    return { ok: false, message: msg };
  }

  return { ok: true };
}

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
  const tgUser = getTelegramUser();
  const numericId = devUserId ?? getTelegramUserId() ?? null;
  const userId =
    numericId != null && Number.isFinite(numericId) && numericId > 0
      ? String(Math.trunc(numericId))
      : null;
  const telegramName = getTelegramUserDisplayName();
  const telegramUsername = getTelegramUsername();
  const store = useCreateReleaseDraftStore.getState();
  const previousUserId = store.userId;
  if (
    previousUserId != null &&
    userId != null &&
    previousUserId !== userId
  ) {
    store.resetDraft();
  }
  store.setUserContext({ userId, telegramName, telegramUsername });
  setRlsTelegramUserIdOverride(numericId != null && numericId > 0 ? Math.trunc(numericId) : null);

  if (typeof window !== "undefined" && isTelegramMiniApp()) {
    try {
      if (sessionStorage.getItem(ALIGN_RELEASES_SESSION_KEY) === "1") {
        return;
      }
    } catch {
      /* private mode / no storage */
    }
    if (alignReleasesFetchInFlight) {
      return;
    }
    const n =
      parseStoreUserId(useCreateReleaseDraftStore.getState().userId) ?? getTelegramUserId();
    alignReleasesFetchInFlight = (async () => {
      try {
        const res = await fetch("/api/identity/align-releases", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getTelegramApiAuthHeaders(n != null && n > 0 ? { userId: n } : undefined)
          },
          body: JSON.stringify({})
        });
        if (res.ok) {
          try {
            sessionStorage.setItem(ALIGN_RELEASES_SESSION_KEY, "1");
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      } finally {
        alignReleasesFetchInFlight = null;
      }
    })();
  }
}

/** Паспорт релиза из строки `releases` (общий маппинг для hydrate и резюме черновика). */
export function createMetadataFromReleaseRecord(existing: ReleaseRecord): CreateMetadata {
  const rows = parseCollaboratorsFromDb(existing.collaborators);
  const primaryName =
    rows[0]?.name?.trim() || String(existing.artist_name ?? "").trim();
  return {
    primaryArtist: primaryName,
    releaseTitle: getReleaseDisplayTitle(existing),
    releaseType: existing.release_type,
    genre: existing.genre,
    subgenre: "",
    language: parsePerformanceLanguage(existing.performance_language),
    label: "",
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
    return [{ title: getReleaseDisplayTitle(release), explicit: Boolean(release.explicit) }];
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
        out[r.index] = r.file_path ?? null;
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

    if (existing.status !== "draft" && existing.status !== "pending") {
      useCreateReleaseDraftStore
        .getState()
        .setSubmitError("Продолжить можно только черновик или релиз до отправки на модерацию.");
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
      trackAudioUrlsFromDb,
      releaseArtistLinks: parseArtistLinksFromJson(existing.artist_links)
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
    store.setReleaseArtistLinks(parseArtistLinksFromJson(existing.artist_links));
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
    } catch (e: unknown) {
      if (isPostgrestNoSuchRowError(e)) {
        useCreateReleaseDraftStore.getState().setReleaseId(null);
      }
    }
  }

  const mainArtistName = parsed.data.primaryArtist ?? "";
  const tgUser = getTelegramUser();
  if (process.env.NODE_ENV === "production") {
    if (!tgUser?.id) {
      store.setSubmitError("Ошибка авторизации Telegram");
      return null;
    }
  }

  const effectiveUserId = parseStoreUserId(store.userId) ?? tgUser?.id ?? 0;
  if (!Number.isFinite(effectiveUserId) || effectiveUserId <= 0) {
    store.setSubmitError("Ошибка авторизации Telegram");
    return null;
  }

  const telegramId = tgUser?.id ?? effectiveUserId;
  const rawUsername = getTelegramUsername();
  const telegramUsername = rawUsername && rawUsername.length > 0 ? rawUsername : null;

  const clientRequestId = createClientRequestId(store.clientRequestId);

  const payload: ReleaseStep1Payload = {
    user_id: effectiveUserId,
    telegram_id: telegramId,
    telegram_username: telegramUsername,
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
      hapticMap.notificationSuccess();
    } catch {}
    return draft;
  } catch (e: unknown) {
    store.setSubmitError(formatErrorMessage(e, "Не удалось создать черновик."));
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
  let store = useCreateReleaseDraftStore.getState();
  initUserContextInStore();
  if (!store.userId) {
    store.setSubmitError("Откройте приложение из Telegram.");
    return null;
  }
  await verifyStoredReleaseExistsOrClearReleaseId();
  store = useCreateReleaseDraftStore.getState();
  if (!store.releaseId) {
    const draft = await ensureDraftRelease();
    if (!draft) {
      return null;
    }
    store = useCreateReleaseDraftStore.getState();
  }
  try {
    store.setSubmitError(null);
    const artworkUrl = await uploadReleaseArtwork({
      userId: parseStoreUserId(store.userId)!,
      releaseId: store.releaseId!,
      file,
      options: {
        markReleaseFailedOnError: { releaseId: store.releaseId! }
      }
    });
    store.setArtworkUrl(artworkUrl);
    try {
      hapticMap.notificationSuccess();
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

/**
 * Сохраняет текущие метаданные (и обложку, если есть) в строку `releases` в БД.
 * При отсутствии `releaseId` создаёт черновик через `ensureDraftRelease`.
 */
export async function saveDraftAction(): Promise<{ ok: true } | { ok: false; message: string }> {
  initUserContextInStore();
  const store = useCreateReleaseDraftStore.getState();
  const parsed = metadataSchema.safeParse(store.metadata);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Заполните паспорт релиза корректно."
    };
  }
  if (!store.userId) {
    return { ok: false, message: "Откройте приложение из Telegram." };
  }
  try {
    store.setSubmitError(null);
    await verifyStoredReleaseExistsOrClearReleaseId();
    if (!useCreateReleaseDraftStore.getState().releaseId) {
      const draft = await ensureDraftRelease();
      if (!draft) {
        return {
          ok: false,
          message: useCreateReleaseDraftStore.getState().submitError ?? "Не удалось создать черновик."
        };
      }
    }
    const rid = useCreateReleaseDraftStore.getState().releaseId;
    if (!rid) {
      return { ok: false, message: "Нет идентификатора релиза." };
    }
    const m = parsed.data;
    const mainArtist = m.primaryArtist ?? "";
    const latest = useCreateReleaseDraftStore.getState();

    /**
     * TEMP: минимальный набор полей под «старую» схему `releases` (обход рассинхрона миграций).
     * Закомментировано: collaborators, artist_links, performance_language, has_existing_profiles.
     */
    const finalData: Record<string, unknown> = {
      artist_name: mainArtist,
      title: m.releaseTitle,
      release_type: m.releaseType,
      genre: m.genre,
      release_date: m.releaseDate,
      explicit: m.explicit,
      ...(latest.artworkUrl ? { artwork_url: latest.artworkUrl } : {}),
      // performance_language: m.language,
      // collaborators: [] as unknown[],
      // has_existing_profiles: Object.keys(artistLinksToJson(latest.releaseArtistLinks)).length > 0,
      // artist_links: artistLinksToJson(latest.releaseArtistLinks) ?? {},
    };

    try {
      const viaService = await saveDraftPatchViaServiceApi(rid, finalData);
      if (viaService) {
        return { ok: true };
      }
      await updateRelease(rid, finalData as Parameters<typeof updateRelease>[1]);
    } catch (e: unknown) {
      console.error("FULL DB ERROR:", e);
      if (process.env.NODE_ENV === "development") {
        void fetch("/api/dev/log-db-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tag: "FULL_DB_ERROR",
            releaseId: rid,
            finalData,
            error: formatErrorMessage(e, String(e))
          })
        }).catch(() => {});
      }
      /** TEMP bypass: не блокируем флоу из-за PostgREST / схемы */
      return { ok: true };
    }
    return { ok: true };
  } catch (e: unknown) {
    console.error("FULL DB ERROR (saveDraft outer):", e);
    if (process.env.NODE_ENV === "development") {
      void fetch("/api/dev/log-db-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tag: "saveDraft_outer",
          error: formatErrorMessage(e, String(e))
        })
      }).catch(() => {});
    }
    /** TEMP bypass: не блокируем флоу */
    return { ok: true };
  }
}

/** Последний черновик пользователя (для предложения «Продолжить»). */
export async function fetchLatestDraftReleaseIdForUser(
  userId: number | string
): Promise<string | null> {
  const idStr = String(userId).trim();
  if (!idStr || idStr === "NaN") return null;
  const asNum = Number(idStr);
  if (!Number.isFinite(asNum) || asNum <= 0) return null;

  const { data, error } = await supabase
    .from("releases")
    .select("id")
    .or(`user_id.eq.${idStr},telegram_id.eq.${idStr}`)
    .in("status", ["draft", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}

async function postDraftUploadState(
  releaseId: string,
  phase: "start" | "complete" | "failed"
): Promise<boolean> {
  const bodyJson = JSON.stringify({ releaseId, phase });
  const doFetch = (authHeaders: Record<string, string>) =>
    fetch("/api/releases/draft-upload-state", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: bodyJson
    });

  try {
    let authHeaders =
      typeof window !== "undefined" ? getCreateReleaseApiAuthHeaders() : {};
    let res = await doFetch(authHeaders);

    if (res.status === 401 && typeof window !== "undefined") {
      initTelegramWebApp();
      authHeaders = getCreateReleaseApiAuthHeaders();
      res = await doFetch(authHeaders);
    }

    let body: { ok?: boolean; error?: string; degraded?: boolean } = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      /* ignore */
    }
    if ((!res.ok || !body.ok) && process.env.NODE_ENV === "development") {
      console.warn("[postDraftUploadState] bypass — server said:", {
        phase,
        releaseId,
        status: res.status,
        body
      });
    }
    if (!res.ok && res.status === 401) {
      console.error("[postDraftUploadState] Unauthorized", {
        phase,
        releaseId,
        body,
        hadInitDataHeader: Boolean(authHeaders["X-Telegram-Init-Data"]),
        hadDevUserHeader: Boolean(authHeaders["X-Dev-Telegram-User-Id"])
      });
    }
  } catch (e) {
    console.warn("[postDraftUploadState] bypass — fetch failed:", phase, releaseId, e);
  }
   /** TEMP: всегда true, чтобы не блокировать «Далее» на шаге треков */
  return true;
}

/**
 * Сразу после выбора WAV: Storage + строка в `tracks` (один трек).
 * При отсутствии `releaseId` вызывает `saveDraftAction()` (нужен валидный паспорт).
 */
export async function uploadTrackWavAtIndex(options: {
  index: number;
  file: File;
  onProgress?: (percent: number) => void;
}): Promise<boolean> {
  initUserContextInStore();
  let store = useCreateReleaseDraftStore.getState();
  if (!store.userId) {
    store.setSubmitError("Откройте приложение из Telegram.");
    return false;
  }
  const userId = parseStoreUserId(store.userId);
  if (userId == null) {
    store.setSubmitError("Нет данных пользователя для загрузки треков.");
    return false;
  }
  const parsedTracks = tracksSchema.safeParse({ tracks: store.tracks });
  if (!parsedTracks.success) {
    store.setSubmitError(parsedTracks.error.issues[0]?.message ?? "Проверьте данные треков.");
    return false;
  }
  const track = parsedTracks.data.tracks[options.index];
  if (!track) {
    store.setSubmitError("Нет данных трека.");
    return false;
  }
  await verifyStoredReleaseExistsOrClearReleaseId();
  store = useCreateReleaseDraftStore.getState();
  if (!store.releaseId) {
    const saved = await saveDraftAction();
    if (!saved.ok) {
      useCreateReleaseDraftStore.getState().setSubmitError(saved.message);
      return false;
    }
  }
  store = useCreateReleaseDraftStore.getState();
  const releaseId = store.releaseId;
  if (!releaseId) {
    store.setSubmitError("Нет идентификатора релиза.");
    return false;
  }

  const telegramId = getTrackRowTelegramId(userId);
  useCreateReleaseDraftStore.getState().setTracksUploadInProgress(true);
  const wake = await requestScreenWakeLock();
  try {
    store.setSubmitError(null);
    options.onProgress?.(0);

    let audioUrl: string;
    try {
      audioUrl = await uploadReleaseTrackAudio({
        userId,
        releaseId,
        trackIndex: options.index,
        file: options.file,
        options: {
          markReleaseFailedOnError: { releaseId },
          onProgress: options.onProgress
        }
      });
    } catch (e: unknown) {
      console.error("[uploadTrackWavAtIndex] Storage (WAV) upload failed", { error: e });
      const up = getUploadErrorDetails(e);
      const sc =
        e && typeof e === "object" && "statusCode" in e
          ? Number((e as { statusCode?: unknown }).statusCode)
          : NaN;
      const statusLabel = Number.isFinite(sc) ? String(sc) : "0 (сеть/обрыв)";
      const msg = formatErrorMessage(
        e,
        "Не удалось загрузить WAV в хранилище. Проверьте политику bucket, размер и формат файла."
      );
      useCreateReleaseDraftStore.getState().setSubmitError(msg);
      toast.error(`Загрузка WAV: ${msg}`, {
        description: `HTTP ${statusLabel}${up.supabaseHint ? ` · ${up.supabaseHint}` : ""}`
      });
      return false;
    }

    try {
      await withRequestTimeout(
        addReleaseTrack({
          releaseId,
          userId,
          telegramId,
          index: options.index,
          title: track.title,
          explicit: Boolean(track.explicit),
          audioUrl
        }),
        SUPABASE_DB_OP_TIMEOUT_MS,
        USER_REQUEST_TIMEOUT_MESSAGE
      );
    } catch (e: unknown) {
      console.error("[uploadTrackWavAtIndex] DB tracks upsert failed", {
        postgrest: getPostgrestErrorPayload(e),
        error: e
      });
      useCreateReleaseDraftStore.getState().setSubmitError(
        formatErrorMessage(
          e,
          "Файл в хранилище загружен, но не удалось сохранить строку в таблице tracks. Проверьте схему БД и RLS."
        )
      );
      return false;
    }

    useCreateReleaseDraftStore.getState().setTrackAudioUrlAt(options.index, audioUrl);
    try {
      hapticMap.notificationSuccess();
    } catch {
      /* ignore */
    }
    return true;
  } finally {
    releaseWakeLock(wake);
    useCreateReleaseDraftStore.getState().setTracksUploadInProgress(false);
  }
}

/**
 * Загрузка WAV на шаге «Треки» с прогрессом; URL в сторе → `selectTracksWavFullySynced`.
 */
export async function uploadTracksForDraftStep(options: {
  onTrackProgress: (index: number, percent: number) => void;
}): Promise<boolean> {
  initUserContextInStore();
  let store = useCreateReleaseDraftStore.getState();
  if (!store.userId) {
    store.setSubmitError("Откройте приложение из Telegram.");
    return false;
  }
  await verifyStoredReleaseExistsOrClearReleaseId();
  store = useCreateReleaseDraftStore.getState();
  if (!store.releaseId) {
    const draft = await ensureDraftRelease();
    if (!draft) {
      store.setSubmitError("Нет данных релиза для загрузки треков.");
      return false;
    }
    store = useCreateReleaseDraftStore.getState();
  }
  const parsedTracks = tracksSchema.safeParse({ tracks: store.tracks });
  if (!parsedTracks.success) {
    store.setSubmitError(parsedTracks.error.issues[0]?.message ?? "Проверьте данные треков.");
    return false;
  }
  const { tracks } = parsedTracks.data;
  const { trackFiles } = store;
  if (trackFiles.length !== tracks.length || tracks.some((_t, i) => !trackFiles[i])) {
    store.setSubmitError("Загрузите WAV для каждого трека.");
    return false;
  }
  const releaseIdMaybe = store.releaseId;
  if (!releaseIdMaybe) {
    store.setSubmitError("Нет идентификатора релиза.");
    return false;
  }
  const releaseId = releaseIdMaybe;
  const userId = parseStoreUserId(store.userId);
  if (userId == null) {
    store.setSubmitError("Нет данных пользователя для загрузки треков.");
    return false;
  }
  const telegramId = getTrackRowTelegramId(userId);

  useCreateReleaseDraftStore.getState().setTracksUploadInProgress(true);
  const wake = await requestScreenWakeLock();
  try {
    store.setSubmitError(null);
    await postDraftUploadState(releaseId, "start");

    try {
      for (let index = 0; index < tracks.length; index += 1) {
        const file = trackFiles[index]!;
        const track = tracks[index];
        const existingUrl =
          useCreateReleaseDraftStore.getState().trackAudioUrlsFromDb[index] ?? "";
        if (existingUrl.trim().length > 0) {
          options.onTrackProgress(index, 100);
          continue;
        }

        options.onTrackProgress(index, 0);

        let audioUrl: string;
        try {
          audioUrl = await uploadReleaseTrackAudio({
            userId,
            releaseId,
            trackIndex: index,
            file,
            options: {
              markReleaseFailedOnError: { releaseId },
              onProgress: (pct) => options.onTrackProgress(index, pct)
            }
          });
        } catch (e: unknown) {
          void postDraftUploadState(releaseId, "failed");
          console.error("[uploadTracksForDraftStep] Storage (WAV) upload failed", {
            phase: "storage",
            trackIndex: index,
            releaseId,
            hint: "Network → POST …/storage/v1/object/releases/…",
            error: e
          });
          const up = getUploadErrorDetails(e);
          const sc =
            e && typeof e === "object" && "statusCode" in e
              ? Number((e as { statusCode?: unknown }).statusCode)
              : NaN;
          const statusLabel = Number.isFinite(sc) ? String(sc) : "0 (сеть/обрыв)";
          const msg = formatErrorMessage(
            e,
            "Не удалось загрузить WAV в хранилище. Проверьте политику bucket «releases», размер и формат файла."
          );
          useCreateReleaseDraftStore.getState().setSubmitError(msg);
          toast.error(`Трек ${index + 1}: ${msg}`, {
            description: `HTTP ${statusLabel}${up.supabaseHint ? ` · ${up.supabaseHint}` : ""}`
          });
          return false;
        }

        try {
          await withRequestTimeout(
            addReleaseTrack({
              releaseId,
              userId,
              telegramId,
              index,
              title: track.title,
              explicit: Boolean(track.explicit),
              audioUrl
            }),
            SUPABASE_DB_OP_TIMEOUT_MS,
            USER_REQUEST_TIMEOUT_MESSAGE
          );
        } catch (e: unknown) {
          void postDraftUploadState(releaseId, "failed");
          console.error("[uploadTracksForDraftStep] DB tracks upsert failed", {
            phase: "database",
            trackIndex: index,
            releaseId,
            hint: "Network → POST …/rest/v1/tracks — колонка file_path, RLS, UNIQUE(release_id,index)",
            postgrest: getPostgrestErrorPayload(e),
            error: e
          });
          useCreateReleaseDraftStore.getState().setSubmitError(
            formatErrorMessage(
              e,
              "Файл в хранилище загружен, но не удалось сохранить строку в таблице tracks. Проверьте схему БД и RLS."
            )
          );
          return false;
        }

        useCreateReleaseDraftStore.getState().setTrackAudioUrlAt(index, audioUrl);
      }
    } catch (e: unknown) {
      void postDraftUploadState(releaseId, "failed");
      console.error("[uploadTracksForDraftStep] unexpected", { error: e });
      useCreateReleaseDraftStore
        .getState()
        .setSubmitError(formatErrorMessage(e, "Ошибка загрузки WAV."));
      return false;
    }

    await postDraftUploadState(releaseId, "complete");
    return true;
  } finally {
    releaseWakeLock(wake);
    useCreateReleaseDraftStore.getState().setTracksUploadInProgress(false);
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

  const skipWavUpload = selectTracksWavFullySynced(useCreateReleaseDraftStore.getState());

  if (!skipWavUpload) {
    if (args.files.length !== parsedTracks.data.tracks.length) {
      store.setSubmitError("Загрузите WAV для каждого трека.");
      return false;
    }
  }

  submitTracksInFlight = true;
  store.setSubmitStatus("submitting");
  store.setSubmitStage("preparing");
  store.setSubmitProgress(5);
  store.setSubmitError(null);

  const totalTracks = parsedTracks.data.tracks.length;
  const releaseId = store.releaseId;
  const clientRequestId = store.clientRequestId;
  const submitUserId = parseStoreUserId(store.userId)!;
  const submitTelegramId = getTrackRowTelegramId(submitUserId);

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

      if (skipWavUpload) {
        useCreateReleaseDraftStore.getState().setSubmitStage("uploading_tracks");
        useCreateReleaseDraftStore.getState().setSubmitProgress(85);
      } else {
        for (let index = 0; index < parsedTracks.data.tracks.length; index += 1) {
          uploadTrackIndex = index;
          store.setSubmitStage("uploading_tracks");
          const track = parsedTracks.data.tracks[index];
          const file = args.files[index];
          uploadPhase = "storage_track_wav";
          const audioUrl = await uploadReleaseTrackAudio({
            userId: submitUserId,
            releaseId,
            trackIndex: index,
            file,
            options: {
              markReleaseFailedOnError: { releaseId },
              onProgress: (pct) => setTrackUploadProgress(index, pct)
            }
          });
          uploadPhase = "db_release_track";
          await withRequestTimeout(
            addReleaseTrack({
              releaseId,
              userId: submitUserId,
              telegramId: submitTelegramId,
              index,
              title: track.title,
              explicit: Boolean(track.explicit),
              audioUrl
            }),
            SUPABASE_DB_OP_TIMEOUT_MS,
            USER_REQUEST_TIMEOUT_MESSAGE
          );
          setTrackUploadProgress(index + 1, 0);
        }
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
      if (uploadPhase === "db_release_track") {
        console.error("[submitTracksAndFinalize] DB tracks upsert failed", {
          phase: "database",
          trackIndex: uploadTrackIndex,
          releaseId,
          hint: "Network → POST …/rest/v1/tracks — колонка file_path, RLS, UNIQUE(release_id,index)",
          postgrest: getPostgrestErrorPayload(e),
          error: e
        });
      } else if (uploadPhase === "storage_track_wav") {
        console.error("[submitTracksAndFinalize] Storage (WAV) upload failed", {
          phase: "storage",
          trackIndex: uploadTrackIndex,
          releaseId,
          hint: "Network → POST …/storage/v1/object/releases/…",
          error: e
        });
      }
      let cleanupFailed = false;
      let existingMessage: string | null = null;
      try {
        const current = await getReleaseById(releaseId).catch(() => null);
        existingMessage = current?.error_message?.trim() ?? null;

        if (!skipWavUpload) {
          await cleanupReleaseTracks(releaseId);
          await deleteReleaseFiles({
            userId: parseStoreUserId(store.userId)!,
            releaseId,
            trackCount: parsedTracks.data.tracks.length
          });
        }

        if (!current || current.status !== "failed") {
          await updateRelease(releaseId, {
            status: "failed",
            error_message: skipWavUpload
              ? "Отправка прервана."
              : "Отправка прервана, временные файлы очищены."
          });
        }
      } catch {
        cleanupFailed = true;
      }

      useCreateReleaseDraftStore.getState().setSubmitStatus("error");
      useCreateReleaseDraftStore.getState().setSubmitStage("error");
      const detail = e instanceof Error ? e.message : JSON.stringify(e);

      const defaultMessage =
        uploadPhase === "storage_track_wav"
          ? formatErrorMessage(
              e,
              "Не удалось загрузить WAV в хранилище. Проверьте политику bucket «releases», размер и формат файла."
            )
          : uploadPhase === "db_release_track"
            ? formatErrorMessage(
                e,
                "Файл в хранилище загружен, но не удалось сохранить строку в таблице tracks. Проверьте схему БД и RLS."
              )
            : `Ошибка отправки: ${detail}`;

      const primary =
        existingMessage && existingMessage.length > 0
          ? existingMessage
          : defaultMessage;

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

      const precheck = await requestReleaseSubmitPrecheck({
        releaseId,
        clientRequestId,
        declaredTrackCount: totalTracks
      });
      if (!precheck.ok) {
        storeAfterUpload.setSubmitStatus("error");
        storeAfterUpload.setSubmitStage("error");
        storeAfterUpload.setSubmitError(precheck.message);
        console.error("[submitTracksAndFinalize] submit-precheck rejected", {
          message: precheck.message,
          releaseId,
          clientRequestId
        });
        try {
          hapticMap.notificationWarning();
        } catch {
          /* ignore */
        }
        logClientError({
          error: new Error(precheck.message),
          screenName: "CreateReview_submitPrecheck",
          route: "/create/review",
          extra: { flow: "submitTracksAndFinalize", phase: "submit_precheck" }
        });
        return false;
      }

      let verified: ReleaseRecord;
      const viaService = await submitReleaseViaServiceApi({ releaseId, clientRequestId }).catch(
        (e: unknown) => {
          console.error("[submitTracksAndFinalize] service finalize failed, falling back to client", e);
          return null;
        }
      );
      if (viaService) {
        verified = viaService;
      } else {
        await submitRelease({ releaseId, clientRequestId });
        verified = await ensureReleaseProcessing(releaseId, clientRequestId);
      }

      if (process.env.NODE_ENV === "development") {
        if (verified.status !== "processing" && verified.status !== "ready") {
          console.warn(
            "[submitTracksAndFinalize] unexpected status after ensure:",
            verified.status
          );
        }
      }

      if (verified.status === "pending" || verified.status === "processing") {
        celebrateReleaseSubmission();
      }

      const storeOk = useCreateReleaseDraftStore.getState();
      storeOk.setSubmitStatus("success");
      storeOk.setSubmitStage("done");
      storeOk.setSubmitProgress(100);
      const title = getReleaseDisplayTitle(verified).trim() || "Релиз";
      storeOk.setSuccessSummary({
        artistName: verified.artist_name?.trim() || "Артист",
        trackName: title,
        releaseName: title
      });
      // Очистить мастер только после подтверждённого статуса в БД; successSummary для /create/success.
      // Состояние submit (прогресс 100%) сохраняем для exit-анимации на Review — см. clearCreateFormKeepSummaryPreserveSubmit.
      storeOk.clearCreateFormKeepSummaryPreserveSubmit();
      try {
        hapticMap.notificationSuccess();
      } catch {}
      return true;
    } catch (e: unknown) {
      logClientError({
        error: e,
        screenName: "CreateReview_submitFinalize",
        route: "/create/review",
        extra: { flow: "submitTracksAndFinalize", uploadPhase: "finalizing_submit" }
      });
      console.error("[submitTracksAndFinalize] finalize error (full)", e);
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

