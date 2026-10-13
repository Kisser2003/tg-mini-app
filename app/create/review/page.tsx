"use client";

import { isLicenseType, LICENSE_TYPE_LABELS } from "@/lib/release-rights";
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ReleaseSleeve } from "@/components/ReleaseSleeve";
import { CreateShell } from "@/features/release/createRelease/components/CreateShell";
import { hapticMap } from "@/lib/haptic-map";
import { cn } from "@/lib/utils";
import { StepGate } from "@/features/release/createRelease/components/StepGate";
import { useStepGuard } from "@/features/release/createRelease/guards";
import {
  selectTracksWavFullySynced,
  useCreateReleaseDraftStore
} from "@/features/release/createRelease/store";
import {
  getLastSubmitPrecheckHttpStatus,
  submitTracksAndFinalize
} from "@/features/release/createRelease/actions";
import { getTelegramApiAuthHeaders, getTelegramInitDataForApiHeader } from "@/lib/telegram";
import { logClientError } from "@/lib/logger";
import {
  acquireTelegramClosingConfirmation,
  releaseTelegramClosingConfirmation,
  triggerHaptic
} from "@/lib/telegram";
import {
  PERFORMANCE_LANGUAGE_LABELS,
  type PerformanceLanguage
} from "@/lib/performance-language";
import { unionFeaturingNamesFromTracks } from "@/lib/collaborators";

const UploadProgress = dynamic(
  () => import("@/components/UploadProgress").then((m) => m.UploadProgress),
  { ssr: false }
);
const FullScreenLoader = dynamic(
  () => import("@/components/FullScreenLoader").then((m) => m.FullScreenLoader),
  { ssr: false }
);

function formatReleaseDateBadge(iso: string | undefined): string {
  const d = iso?.trim();
  if (!d) return "—";
  const parsed = new Date(`${d}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed
    .toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric"
    })
    .replace(/\s*г\.?$/, "");
}

const RELEASE_TYPE_RU: Record<string, string> = {
  single: "Сингл",
  ep: "EP",
  album: "Альбом"
};

export default function CreateReviewPage() {
  const router = useRouter();
  const guard = useStepGuard("review");

  const releaseId = useCreateReleaseDraftStore((s) => s.releaseId);
  const metadata = useCreateReleaseDraftStore((s) => s.metadata);
  const artworkUrl = useCreateReleaseDraftStore((s) => s.artworkUrl);
  const tracks = useCreateReleaseDraftStore((s) => s.tracks);
  const trackFiles = useCreateReleaseDraftStore((s) => s.trackFiles);
  const trackAudioUrlsFromDb = useCreateReleaseDraftStore((s) => s.trackAudioUrlsFromDb);
  const submitError = useCreateReleaseDraftStore((s) => s.submitError);
  const setSubmitError = useCreateReleaseDraftStore((s) => s.setSubmitError);
  const submitStatus = useCreateReleaseDraftStore((s) => s.submitStatus);
  const successSummary = useCreateReleaseDraftStore((s) => s.successSummary);
  const submitStage = useCreateReleaseDraftStore((s) => s.submitStage);
  const submitProgress = useCreateReleaseDraftStore((s) => s.submitProgress);
  const tracksWavSyncedToDb = useCreateReleaseDraftStore(selectTracksWavFullySynced);
  const tracksUploadInProgress = useCreateReleaseDraftStore((s) => s.tracksUploadInProgress);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  /** Нажали «Отправить» без галочки — подсвечиваем её вместо неактивной кнопки. */
  const [termsHint, setTermsHint] = useState(false);
  const [progressDismissed, setProgressDismissed] = useState(false);
  const prevSubmitErrorRef = useRef<string | null>(null);

  const missingFiles = useMemo(() => {
    if (tracksWavSyncedToDb) return false;
    return tracks.some((_t, i) => !trackFiles[i]);
  }, [tracksWavSyncedToDb, trackFiles, tracks]);
  const submitBlocked =
    missingFiles ||
    tracksUploadInProgress ||
    isSubmitting ||
    submitStatus === "submitting" ||
    submitStatus === "success";

  const stageLabel = useMemo(() => {
    if (submitStage === "preparing") return "Подготавливаем релиз";
    if (submitStage === "uploading_tracks")
      return `Загрузка WAV ${Math.round(submitProgress)}%`;
    if (submitStage === "finalizing") return "Передаем релиз в модерацию";
    if (submitStage === "done") return "Готово";
    if (submitStage === "error") return "Ошибка отправки";
    return "Ожидание отправки";
  }, [submitStage, submitProgress]);

  const showProgressPanel =
    submitStatus === "submitting" ||
    submitStatus === "error" ||
    (submitStatus === "success" && !progressDismissed);

  const progressActive = isSubmitting || submitStatus === "submitting";

  const releaseTitle = metadata.releaseTitle?.trim() || "Релиз";
  const artistName = metadata.primaryArtist?.trim() || "Артист";
  const featuringLine = useMemo(
    () => unionFeaturingNamesFromTracks(tracks).join(", "),
    [tracks]
  );

  useEffect(() => {
    if (submitStatus === "success") {
      const t = window.setTimeout(() => setProgressDismissed(true), 450);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [submitStatus]);

  useEffect(() => {
    const busy = isSubmitting || submitStatus === "submitting";
    if (!busy) return;
    acquireTelegramClosingConfirmation();
    return () => releaseTelegramClosingConfirmation();
  }, [isSubmitting, submitStatus]);

  useEffect(() => {
    if (submitError && submitError !== prevSubmitErrorRef.current) {
      const isFileRelated = /wav|файл|загруз/i.test(submitError);
      if (isFileRelated) {
        hapticMap.notificationError();
      }
    }
    prevSubmitErrorRef.current = submitError;
  }, [submitError]);

  const handleSubmit = useCallback(async () => {
    if (!termsAccepted) {
      setTermsHint(true);
      hapticMap.notificationError();
      return;
    }
    setSubmitError(null);
    setProgressDismissed(false);
    if (missingFiles) {
      const msg =
        "Не хватает WAV-файлов в этой сессии. Загрузите их на шаге «Треки» — даже если в базе уже есть старые файлы.";
      setSubmitError(msg);
      hapticMap.notificationError();
      toast.error(msg);
      logClientError({
        error: new Error("review_precheck_missing_wav"),
        screenName: "CreateReview_precheck",
        route: "/create/review",
        extra: { phase: "precheck", kind: "missing_session_wav" }
      });
      return;
    }
    /** Весомый «клик» на отправку; успех (notification) сыграет экран «Готово», когда он реально наступит. */
    hapticMap.impactMedium();
    const files = trackFiles.filter(Boolean) as File[];
    setIsSubmitting(true);
    let ok = false;
    try {
      ok = await submitTracksAndFinalize({ files, termsAccepted });
    } finally {
      setIsSubmitting(false);
    }
    if (!ok) {
      const st = useCreateReleaseDraftStore.getState();
      const msg = st.submitError;
      const precheckStatus = getLastSubmitPrecheckHttpStatus();
      const storeUid = st.userId
        ? Number(st.userId)
        : undefined;
      const authHeaders = getTelegramApiAuthHeaders(
        storeUid != null && Number.isFinite(storeUid) && storeUid > 0
          ? { userId: storeUid }
          : undefined
      );
      const authDebug = {
        note:
          "Authorization не используется; для API нужны X-Telegram-Init-Data и/или (в dev) X-Dev-Telegram-User-Id — см. Network.",
        xTelegramInitDataLength: getTelegramInitDataForApiHeader().length,
        xTelegramInitDataPreview: getTelegramInitDataForApiHeader().slice(0, 320),
        devUserIdHeader: authHeaders["X-Dev-Telegram-User-Id"] ?? null,
        storeUserId: st.userId
      };
      console.error("[CreateReview] submitTracksAndFinalize failed", {
        submitError: msg,
        submitStage: st.submitStage,
        submitStatus: st.submitStatus,
        releaseId: st.releaseId,
        clientRequestId: st.clientRequestId,
        userId: st.userId,
        lastSubmitPrecheckHttpStatus: precheckStatus
      });
      if (
        precheckStatus === 401 ||
        msg === "Unauthorized" ||
        (typeof msg === "string" && msg.includes("подтвердить сессию"))
      ) {
        console.error("[CreateReview] 401 / Telegram auth debug (full)", authDebug);
        alert(
          `401 / Telegram auth\n\n${authDebug.note}\n\ninitData length: ${authDebug.xTelegramInitDataLength}\npreview (truncated):\n${authDebug.xTelegramInitDataPreview}\n\nstore userId: ${String(authDebug.storeUserId)}\nX-Dev-Telegram-User-Id (dev): ${authDebug.devUserIdHeader ?? "—"}`
        );
      }
      const toastText = msg ?? "Не удалось отправить релиз на модерацию. Статус не изменён.";
      hapticMap.notificationError();
      toast.error(toastText);
      logClientError({
        error: new Error(toastText),
        screenName: "CreateReview_submitResult",
        route: "/create/review",
        extra: {
          phase: "after_submitTracksAndFinalize",
          submitStage: st.submitStage,
          submitStatus: st.submitStatus,
          detailLoggedInActions: true
        }
      });
      return;
    }
    router.replace("/create/success");
  }, [missingFiles, setSubmitError, trackFiles, router, termsAccepted]);

  if (submitStatus === "success" && successSummary) {
    return (
      <CreateShell title="Проверка">
        <FullScreenLoader label="Готово — переходим…" />
      </CreateShell>
    );
  }

  if (!guard.allowed) {
    if (guard.title === "Загрузка…") {
      return (
        <CreateShell title="Проверка">
          <FullScreenLoader />
        </CreateShell>
      );
    }
    if (isSubmitting || submitStatus === "submitting") {
      return (
        <CreateShell title="Проверка">
          <FullScreenLoader label="Отправляем релиз…" />
        </CreateShell>
      );
    }
    return (
      <CreateShell title="Проверка">
        <StepGate
          title={guard.title}
          description={guard.description}
          actionLabel={guard.actionLabel}
          onAction={() => router.push(`/create/${guard.redirectTo}`)}
        />
      </CreateShell>
    );
  }

  const passportRows: { label: string; value: string }[] = [
    { label: "Артист", value: artistName },
    { label: "Формат", value: RELEASE_TYPE_RU[metadata.releaseType] ?? metadata.releaseType },
    { label: "Жанр", value: metadata.genre?.trim() || "Не выбран" },
    {
      label: "Язык",
      value:
        PERFORMANCE_LANGUAGE_LABELS[metadata.language as PerformanceLanguage] ?? metadata.language
    },
    { label: "Дата выхода", value: formatReleaseDateBadge(metadata.releaseDate) },
    { label: "Мат в тексте", value: metadata.explicit ? "Есть" : "Нет" },
    { label: "ФИО артиста", value: metadata.authorFullName?.trim() || "Не указано" },
    { label: "Автор бита", value: metadata.musicAuthor?.trim() || "Не указан" },
    {
      label: "Бит",
      value: isLicenseType(metadata.licenseType)
        ? LICENSE_TYPE_LABELS[metadata.licenseType]
        : "Не указано"
    },
    { label: "Отрывок TikTok", value: metadata.tiktokStart?.trim() ? `с ${metadata.tiktokStart.trim()}` : "Не указан" }
  ];
  if (featuringLine) passportRows.push({ label: "Участники", value: featuringLine });

  return (
    <CreateShell title="Проверка">
      <div className="space-y-8">
        <div className="mx-auto w-[64%] max-w-[260px]">
          <ReleaseSleeve
            seed={releaseId ?? releaseTitle}
            title={releaseTitle}
            artist={artistName}
            coverUrl={artworkUrl}
            size="hero"
          />
        </div>

        <p className="text-[15px] leading-relaxed text-omf-graphite">
          Проверь данные: после отправки релиз попадёт к модератору.
          {tracksWavSyncedToDb
            ? " Аудио уже загружено, осталось нажать кнопку."
            : " Аудио мы загрузим при отправке."}
        </p>

        <section aria-labelledby="review-passport">
          <h3 id="review-passport" className="text-[13px] text-omf-graphite">
            Паспорт
          </h3>
          <dl className="mt-1">
            {passportRows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 border-b border-omf-line py-3"
              >
                <dt className="shrink-0 text-[14px] text-omf-graphite">{row.label}</dt>
                <dd className="min-w-0 break-words text-right text-[15px]">{row.value}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4 border-b border-omf-line py-3">
              <dt className="shrink-0 text-[14px] text-omf-graphite">Обложка</dt>
              <dd className={`text-right text-[15px] ${artworkUrl ? "" : "text-omf-red"}`}>
                {artworkUrl ? "Загружена" : "Не загружена"}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="review-tracks">
          <h3 id="review-tracks" className="text-[13px] text-omf-graphite">
            {tracks.length > 1 ? `Треки, ${tracks.length}` : "Трек"}
          </h3>
          <ol className="mt-1">
            {tracks.map((t, i) => {
              const hasFile = Boolean(trackFiles[i]);
              const dbUrl = trackAudioUrlsFromDb[i] ?? null;
              const ok = tracksWavSyncedToDb || hasFile;
              const wavLabel = tracksWavSyncedToDb
                ? "аудио на сервере"
                : hasFile
                  ? "файл выбран"
                  : dbUrl
                    ? "выбери файл заново"
                    : "нет аудио";
              return (
                // eslint-disable-next-line react/no-array-index-key
                <li
                  key={i}
                  className="flex min-w-0 items-baseline gap-3 border-b border-omf-line py-3 text-[15px]"
                >
                  {tracks.length > 1 ? (
                    <span className="w-5 shrink-0 tabular-nums text-omf-faint">{i + 1}</span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{t.title || "Без названия"}</span>
                  <span
                    className={`shrink-0 text-[13px] ${ok ? "text-omf-graphite" : "text-omf-red"}`}
                  >
                    {wavLabel}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        {missingFiles && (
          <div className="rounded-control border border-omf-yellow px-4 py-3.5 text-[14px] leading-relaxed text-omf-ink">
            Чтобы отправить релиз, выбери WAV-файлы заново: после возврата из черновика приложение
            их не помнит.{" "}
            <Link href="/create/tracks" className="font-bold underline underline-offset-4">
              Вернуться к трекам
            </Link>
          </div>
        )}

        <div>
          {!progressActive ? (
            <div className="mb-4">
              <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-relaxed text-omf-graphite">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  disabled={isSubmitting}
                  aria-invalid={termsHint && !termsAccepted}
                  onChange={(e) => {
                    hapticMap.selection();
                    setTermsAccepted(e.target.checked);
                    if (e.target.checked) setTermsHint(false);
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded-[6px] accent-[var(--omf-ultra)]"
                />
                <span>
                  Выпуск платный, стоимость согласовывается со студией. Оплата не возвращается, в
                  том числе если площадки не пропустили релиз из-за содержания.
                </span>
              </label>
              {termsHint && !termsAccepted ? (
                <p role="alert" className="omf-fade-enter mt-2 pl-8 text-[14px] text-omf-red">
                  Отметь галочку, чтобы отправить релиз.
                </p>
              ) : null}
            </div>
          ) : null}
          {!progressActive ? (
            <button
              type="button"
              disabled={submitBlocked}
              onClick={() => void handleSubmit()}
              className="create-flow-submit-target omf-btn-primary h-14 w-full text-[16px]"
            >
              {tracksUploadInProgress ? "Загружаем WAV…" : "Отправить на проверку"}
            </button>
          ) : null}

          {showProgressPanel ? (
            <div className={cn("omf-fade-enter", !progressActive && "mt-4")}>
              <UploadProgress label={stageLabel} progress={submitProgress} />
            </div>
          ) : null}

          {submitError && (
            <p className="mt-4 break-words text-center text-[14px] leading-relaxed text-omf-red">
              {submitError}{" "}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  router.push("/create/tracks");
                }}
                className="inline font-bold underline underline-offset-4"
              >
                Вернуться к трекам
              </button>
            </p>
          )}
        </div>
      </div>
    </CreateShell>
  );
}
