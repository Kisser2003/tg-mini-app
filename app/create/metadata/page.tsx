"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Controller, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Calendar, Disc, FileSignature, Languages, Mic2, Music2, Timer } from "lucide-react";
import { FormFieldError } from "@/components/FormFieldError";
import { MetadataSelectField } from "@/features/release/createRelease/components/MetadataSelectField";
import { CreateShell } from "@/features/release/createRelease/components/CreateShell";
import {
  FIXED_RELEASE_LABEL,
  metadataSchema
} from "@/features/release/createRelease/schemas";
import type { CreateMetadata } from "@/features/release/createRelease/types";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import {
  fetchLatestDraftReleaseIdForUser,
  hydrateFromReleaseId,
  initUserContextInStore,
  saveDraftAction,
  syncPassportFormToReleaseDraft
} from "@/features/release/createRelease/actions";
import { logClientError } from "@/lib/logger";
import { firstRhfErrorMessage } from "@/lib/rhf-first-error";
import { hapticMap } from "@/lib/haptic-map";
import { toast } from "sonner";
import { getTelegramUserId } from "@/lib/telegram";
import {
  getMetadataFieldWarningFlags,
  validateMetadata,
  type ReleaseMetadata
} from "@/lib/metadata-validator";
import {
  PERFORMANCE_LANGUAGE_LABELS,
  PERFORMANCE_LANGUAGE_VALUES
} from "@/lib/performance-language";
import {
  GLASS_DATE_WRAP_BASE,
  GLASS_DATE_WRAP_ERROR_SOFT,
  GLASS_DATE_WRAP_ERROR_STRONG,
  GLASS_FIELD_ERROR_SOFT,
  GLASS_FIELD_ERROR_STRONG,
  WIZARD_FIELD_LABEL_CLASS,
  WIZARD_INPUT_CLASS
} from "@/lib/glass-form-classes";
import type { ReleaseType } from "@/lib/db-enums";
import {
  GENRE_OPTIONS,
  LICENSE_TYPE_LABELS,
  LICENSE_TYPE_VALUES
} from "@/lib/release-rights";

const ArtistProfileLinksSection = dynamic(
  () =>
    import("@/features/release/createRelease/components/ArtistProfileLinksSection").then(
      (m) => m.ArtistProfileLinksSection
    ),
  { ssr: false }
);

const RELEASE_TYPE_SEGMENTS: { value: ReleaseType; label: string }[] = [
  { value: "single", label: "Сингл" },
  { value: "ep", label: "EP" },
  { value: "album", label: "Альбом" }
];

function borderForField(
  hasError: boolean,
  touched: boolean | undefined,
  dirty: boolean | undefined,
  hasGuidelineWarning?: boolean
): string {
  if (hasError) {
    if (dirty) return GLASS_FIELD_ERROR_STRONG;
    if (touched) return GLASS_FIELD_ERROR_SOFT;
    return "";
  }
  if (hasGuidelineWarning) {
    return "border-omf-yellow";
  }
  return "";
}

function borderForDateWrap(
  hasError: boolean,
  touched: boolean | undefined,
  dirty: boolean | undefined
): string {
  if (!hasError) return "";
  if (dirty) return GLASS_DATE_WRAP_ERROR_STRONG;
  if (touched) return GLASS_DATE_WRAP_ERROR_SOFT;
  return "";
}


function CreateMetadataPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const releaseIdParam = searchParams.get("releaseId");

  const storeMetadata = useCreateReleaseDraftStore((s) => s.metadata);
  const releaseId = useCreateReleaseDraftStore((s) => s.releaseId);
  const hasHydrated = useCreateReleaseDraftStore((s) => s.hasHydrated);
  const setMetadata = useCreateReleaseDraftStore((s) => s.setMetadata);
  const storeTracks = useCreateReleaseDraftStore((s) => s.tracks);
  const setTracks = useCreateReleaseDraftStore((s) => s.setTracks);
  const syncTrackFilesLength = useCreateReleaseDraftStore((s) => s.syncTrackFilesLength);
  const [isHydrating, setIsHydrating] = useState(Boolean(releaseIdParam));
  const [hydrateError, setHydrateError] = useState<string | null>(null);
  const [draftOfferId, setDraftOfferId] = useState<string | null>(null);
  const [isDraftBannerVisible, setIsDraftBannerVisible] = useState(true);
  const continueDraftNavIdRef = useRef<string | null>(null);

  useEffect(() => {
    initUserContextInStore();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!releaseIdParam) return;
      setHydrateError(null);
      setIsHydrating(true);
      try {
        await hydrateFromReleaseId(releaseIdParam);
      } catch (error) {
        console.error("[create/metadata] hydrateFromReleaseId failed", error);
        logClientError({
          error,
          screenName: "CreateMetadata_hydrate",
          route: "/create/metadata"
        });
        if (!cancelled) {
          setHydrateError("Не удалось загрузить данные релиза. Попробуйте обновить страницу.");
        }
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [releaseIdParam]);

  useEffect(() => {
    if (releaseIdParam) return;
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem("omf_skip_draft_prompt") === "1") return;
    } catch {
      /* ignore */
    }
    initUserContextInStore();
    const uid = getTelegramUserId();
    if (!uid) return;
    const localRid = useCreateReleaseDraftStore.getState().releaseId;
    if (localRid) return;
    let cancelled = false;
    void (async () => {
      const id = await fetchLatestDraftReleaseIdForUser();
      if (!cancelled && id) setDraftOfferId(id);
    })();
    return () => {
      cancelled = true;
    };
  }, [releaseIdParam]);

  useEffect(() => {
    if (draftOfferId) setIsDraftBannerVisible(true);
  }, [draftOfferId]);

  const defaultValues: CreateMetadata = useMemo(
    () => ({ ...storeMetadata, label: FIXED_RELEASE_LABEL }),
    [storeMetadata]
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    getValues,
    formState: { errors, isDirty, dirtyFields, touchedFields, isSubmitting }
  } = useForm<CreateMetadata>({
    resolver: zodResolver(metadataSchema),
    mode: "onChange",
    defaultValues
  });

  const values = watch();
  const lastSyncedValuesRef = useRef<string>("");
  const serverSyncTimerRef = useRef<number | null>(null);

  const flushPassportToZustand = useCallback(() => {
    const v = getValues();
    const serialized = JSON.stringify(v);
    if (serialized === lastSyncedValuesRef.current) return;
    setMetadata(v);
    lastSyncedValuesRef.current = serialized;
  }, [getValues, setMetadata]);

  const clearServerSyncTimer = useCallback(() => {
    if (serverSyncTimerRef.current != null) {
      window.clearTimeout(serverSyncTimerRef.current);
      serverSyncTimerRef.current = null;
    }
  }, []);

  const flushPassportToServerNow = useCallback(() => {
    clearServerSyncTimer();
    const rid = useCreateReleaseDraftStore.getState().releaseId;
    if (!rid) return;
    void syncPassportFormToReleaseDraft(getValues());
  }, [clearServerSyncTimer, getValues]);

  // После rehydrate persist синхронизируем RHF один раз из store (без releaseId в URL).
  const didSyncHydratedDefaultsRef = useRef(false);
  useEffect(() => {
    if (releaseIdParam) return;
    if (!hasHydrated) return;
    if (didSyncHydratedDefaultsRef.current) return;
    didSyncHydratedDefaultsRef.current = true;
    const hydrated = { ...storeMetadata, label: FIXED_RELEASE_LABEL };
    reset(hydrated, { keepDirty: false });
    lastSyncedValuesRef.current = JSON.stringify(hydrated);
  }, [reset, releaseIdParam, hasHydrated, storeMetadata]);

  // Single: keep store track list aligned with one WAV slot (avoid orphan trackFiles after EP → Single).
  useEffect(() => {
    if (values.releaseType !== "single") return;
    const tracks = useCreateReleaseDraftStore.getState().tracks;
    if (tracks.length <= 1) return;
    const releaseTitleTrim = values.releaseTitle?.trim() ?? "";
    const base = tracks[0] ?? { title: "", explicit: false };
    const trackTitleTrim = typeof base.title === "string" ? base.title.trim() : "";
    // Сохраняем уже введённое название трека (фит / полное имя), иначе — название релиза.
    setTracks([{ ...base, title: trackTitleTrim || releaseTitleTrim }]);
    syncTrackFilesLength(1);
  }, [values.releaseType, values.releaseTitle, setTracks, syncTrackFilesLength]);

  useEffect(() => {
    if (!releaseIdParam || isHydrating || hydrateError) return;
    const meta = useCreateReleaseDraftStore.getState().metadata;
    const normalized = { ...meta, label: FIXED_RELEASE_LABEL };
    reset(normalized, { keepDirty: false });
    lastSyncedValuesRef.current = JSON.stringify(normalized);
  }, [releaseIdParam, isHydrating, hydrateError, reset]);

  const metaForGuidelines = useMemo<ReleaseMetadata>(() => {
    const rawTitles = storeTracks.map((t) => t.title);
    const hasAnyTrackTitle = rawTitles.some((t) => t.trim().length > 0);
    return {
      primaryArtist: values.primaryArtist ?? "",
      releaseTitle: values.releaseTitle ?? "",
      trackTitles: hasAnyTrackTitle ? rawTitles : undefined
    };
  }, [values.primaryArtist, values.releaseTitle, storeTracks]);

  const guidelineFieldFlags = useMemo(
    () => getMetadataFieldWarningFlags(metaForGuidelines),
    [metaForGuidelines]
  );

  // Каждый символ → сразу в Zustand + localStorage (persist). Debounce убираем: при свайпе закрытия
  // Mini App таймер отменяется и прогресс не успевал сохраниться.
  useEffect(() => {
    if (!isDirty) return;
    const serialized = JSON.stringify(values);
    if (serialized === lastSyncedValuesRef.current) return;
    setMetadata(values);
    lastSyncedValuesRef.current = serialized;
  }, [values, isDirty, setMetadata]);

  // Уже есть строка в БД — дублируем паспорт в Supabase (редко: debounce), плюс мгновенно на blur / pagehide.
  useEffect(() => {
    if (!releaseId || !isDirty) return;
    clearServerSyncTimer();
    serverSyncTimerRef.current = window.setTimeout(() => {
      serverSyncTimerRef.current = null;
      void syncPassportFormToReleaseDraft(getValues());
    }, 1100);
    return () => clearServerSyncTimer();
  }, [values, isDirty, releaseId, getValues, clearServerSyncTimer]);

  // Ссылки на профили живут в сторе, а не в RHF: синхронизируем их отдельно.
  const releaseArtistLinks = useCreateReleaseDraftStore((s) => s.releaseArtistLinks);
  const lastSyncedLinksRef = useRef<string | null>(null);
  useEffect(() => {
    const serialized = JSON.stringify(releaseArtistLinks);
    if (lastSyncedLinksRef.current === null) {
      lastSyncedLinksRef.current = serialized;
      return;
    }
    if (serialized === lastSyncedLinksRef.current || !releaseId) return;
    lastSyncedLinksRef.current = serialized;
    clearServerSyncTimer();
    serverSyncTimerRef.current = window.setTimeout(() => {
      serverSyncTimerRef.current = null;
      void syncPassportFormToReleaseDraft(getValues());
    }, 1100);
    return () => clearServerSyncTimer();
  }, [releaseArtistLinks, releaseId, getValues, clearServerSyncTimer]);

  useEffect(() => {
    const onVisibilityHidden = () => {
      if (document.visibilityState !== "hidden") return;
      flushPassportToZustand();
    };
    const onPageHide = () => {
      flushPassportToZustand();
      void syncPassportFormToReleaseDraft(getValues(), { keepalive: true });
    };
    document.addEventListener("visibilitychange", onVisibilityHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityHidden);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [flushPassportToZustand, getValues]);

  const minReleaseDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const min = new Date(today);
    min.setDate(min.getDate() + 5);
    const year = min.getFullYear();
    const month = String(min.getMonth() + 1).padStart(2, "0");
    const day = String(min.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const isEarlyReleaseDate = useMemo(() => {
    const d = values.releaseDate?.trim();
    if (!d) return false;
    const picked = new Date(`${d}T12:00:00`);
    if (Number.isNaN(picked.getTime())) return false;
    const threshold = new Date();
    threshold.setHours(0, 0, 0, 0);
    threshold.setDate(threshold.getDate() + 14);
    return picked < threshold;
  }, [values.releaseDate]);

  const onSubmit = useCallback(async (data: CreateMetadata) => {
    try {
      hapticMap.impactLight();
      const tracks = useCreateReleaseDraftStore.getState().tracks;
      const rawTitles = tracks.map((t) => t.title);
      const hasAnyTrackTitle = rawTitles.some((t) => t.trim().length > 0);
      const links = useCreateReleaseDraftStore.getState().releaseArtistLinks;
      const meta: ReleaseMetadata = {
        primaryArtist: data.primaryArtist,
        releaseTitle: data.releaseTitle,
        trackTitles: hasAnyTrackTitle ? rawTitles : undefined,
        language: data.language,
        releaseArtistLinks: links
      };
      const dsp = validateMetadata(meta);
      if (!dsp.isValid) {
        hapticMap.notificationError();
        toast.error(
          dsp.errors[0] ??
            "Метаданные не проходят базовую проверку. Исправьте поля с подсказкой."
        );
        return;
      }
      setMetadata(data);
      const saved = await saveDraftAction(data);
      if (!saved.ok) {
        hapticMap.notificationError();
        toast.error(saved.message);
        return;
      }
      router.push("/create/assets");
    } catch (error) {
      hapticMap.notificationError();
      logClientError({
        error,
        screenName: "CreateMetadata_submit",
        route: "/create/metadata"
      });
      toast.error("Не удалось перейти к шагу обложки. Попробуйте ещё раз.");
    }
  }, [router, setMetadata]);

  const onInvalid = useCallback((formErrors: FieldErrors<CreateMetadata>) => {
    hapticMap.notificationError();
    toast.error(firstRhfErrorMessage(formErrors));
  }, []);

  const canProceed =
    Boolean(values.primaryArtist?.trim()) &&
    Boolean(values.releaseTitle?.trim()) &&
    Boolean(values.genre?.trim()) &&
    Boolean(values.language);

  return (
    <CreateShell>
      <div>
        {isHydrating ? (
          <div
            className="pointer-events-none flex flex-col gap-4"
            aria-busy
            aria-label="Загрузка данных релиза"
          >
            <div className="h-3 w-40 animate-pulse rounded-md bg-omf-surface" />
            <div className="space-y-2">
              <div className="h-2.5 w-16 animate-pulse rounded bg-omf-surface" />
              <div className="h-12 w-full animate-pulse rounded-[14px] bg-omf-surface" />
            </div>
            <div className="space-y-2">
              <div className="h-2.5 w-28 animate-pulse rounded bg-omf-surface" />
              <div className="h-12 w-full animate-pulse rounded-[14px] bg-omf-surface" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="h-14 animate-pulse rounded-[14px] bg-omf-surface" />
              <div className="h-14 animate-pulse rounded-[14px] bg-omf-surface" />
              <div className="h-14 animate-pulse rounded-[14px] bg-omf-surface" />
              <div className="h-14 animate-pulse rounded-[14px] bg-omf-surface" />
            </div>
            <div className="space-y-2">
              <div className="h-2.5 w-36 animate-pulse rounded bg-omf-surface" />
              <div className="h-12 w-full animate-pulse rounded-[14px] bg-omf-surface" />
            </div>
            <div className="h-14 animate-pulse rounded-[20px] bg-omf-surface" />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit, onInvalid)}
            onBlurCapture={() => {
              flushPassportToZustand();
              flushPassportToServerNow();
            }}
            className="flex flex-col gap-6"
          >
            {hydrateError && (
              <p className="break-words rounded-control border border-omf-red px-3 py-2.5 text-[14px] leading-relaxed text-omf-ink">
                {hydrateError}
              </p>
            )}
            <AnimatePresence
              mode="popLayout"
              onExitComplete={() => {
                const id = continueDraftNavIdRef.current;
                continueDraftNavIdRef.current = null;
                if (id) {
                  router.push(`/create/metadata?releaseId=${id}`);
                }
                setDraftOfferId(null);
                setIsDraftBannerVisible(true);
              }}
            >
              {draftOfferId && isDraftBannerVisible && (
                <motion.div
                  key="draft-offer-banner"
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-control border border-omf-line-strong bg-omf-surface px-4 py-4 text-[14px] leading-relaxed"
                >
                  <p className="text-[16px] font-bold tracking-tight text-omf-ink">У тебя есть незавершённый релиз</p>
                  <p className="mt-1 text-omf-graphite">
                    Продолжить с того места, где остановился, или начать новый?
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!draftOfferId) return;
                        continueDraftNavIdRef.current = draftOfferId;
                        setIsDraftBannerVisible(false);
                      }}
                      className="omf-btn-primary min-h-[44px] px-4 text-[14px]"
                    >
                      Продолжить
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          sessionStorage.setItem("omf_skip_draft_prompt", "1");
                        } catch {
                          /* ignore */
                        }
                        continueDraftNavIdRef.current = null;
                        setIsDraftBannerVisible(false);
                      }}
                      className="omf-btn-secondary min-h-[44px] px-4 text-[14px]"
                    >
                      Начать новый
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="min-w-0 space-y-1.5">
              <label
                className={`mb-2.5 flex items-center gap-2 ${WIZARD_FIELD_LABEL_CLASS}`}
              >
                <Mic2 className="h-3.5 w-3.5 text-omf-faint" aria-hidden />
                Артист
              </label>
              <Controller
                name="primaryArtist"
                control={control}
                render={({ field }) => (
                  <input
                    name={field.name}
                    ref={field.ref}
                    value={typeof field.value === "string" ? field.value : ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    className={`${WIZARD_INPUT_CLASS} ${borderForField(
                      Boolean(errors.primaryArtist),
                      touchedFields.primaryArtist,
                      dirtyFields.primaryArtist,
                      guidelineFieldFlags.primaryArtist
                    )}`}
                    placeholder="Имя на обложке"
                    autoComplete="off"
                  />
                )}
              />
              <FormFieldError message={errors.primaryArtist?.message} />
            </div>

            <div className="min-w-0 space-y-1.5">
              <label className={`mb-2.5 block ${WIZARD_FIELD_LABEL_CLASS}`}>
                Название релиза
              </label>
              <Controller
                name="releaseTitle"
                control={control}
                render={({ field }) => (
                  <input
                    name={field.name}
                    ref={field.ref}
                    value={typeof field.value === "string" ? field.value : ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    className={`${WIZARD_INPUT_CLASS} ${borderForField(
                      Boolean(errors.releaseTitle),
                      touchedFields.releaseTitle,
                      dirtyFields.releaseTitle,
                      guidelineFieldFlags.releaseTitle
                    )}`}
                    placeholder="Основное название релиза"
                    autoComplete="off"
                  />
                )}
              />
              <FormFieldError message={errors.releaseTitle?.message} />
            </div>

            <MetadataSelectField
              label="Язык исполнения"
              Icon={Languages}
              errorMessage={errors.language?.message}
              {...register("language")}
              selectClassName={borderForField(
                Boolean(errors.language),
                touchedFields.language,
                dirtyFields.language
              )}
            >
              {PERFORMANCE_LANGUAGE_VALUES.map((code) => (
                <option key={code} value={code}>
                  {PERFORMANCE_LANGUAGE_LABELS[code]}
                </option>
              ))}
            </MetadataSelectField>

            <MetadataSelectField
              label="Контент с матом"
              Icon={AlertTriangle}
              iconClassName={values.explicit ? "text-omf-yellow" : "text-omf-faint"}
              errorMessage={errors.explicit?.message}
              value={values.explicit ? "explicit" : "clean"}
              onChange={(e) =>
                setValue("explicit", e.target.value === "explicit", {
                  shouldValidate: true,
                  shouldDirty: true,
                  shouldTouch: true
                })
              }
              selectClassName={borderForField(
                Boolean(errors.explicit),
                touchedFields.explicit,
                dirtyFields.explicit
              )}
            >
              <option value="clean">Чистая версия</option>
              <option value="explicit">Есть мат</option>
            </MetadataSelectField>

            <MetadataSelectField
              label="Жанр"
              Icon={Music2}
              errorMessage={errors.genre?.message}
              {...register("genre")}
              selectClassName={borderForField(
                Boolean(errors.genre),
                touchedFields.genre,
                dirtyFields.genre
              )}
            >
              <option value="" disabled hidden>
                —
              </option>
              {GENRE_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </MetadataSelectField>

            <div className="min-w-0">
              <label
                className={`mb-3 flex items-center gap-2 ${WIZARD_FIELD_LABEL_CLASS}`}
              >
                <Disc className="h-3.5 w-3.5 text-omf-faint" aria-hidden />
                Тип релиза
              </label>
              <div className="flex gap-2">
                {RELEASE_TYPE_SEGMENTS.map(({ value: rt, label }) => {
                  const active = values.releaseType === rt;
                  return (
                    <button
                      key={rt}
                      type="button"
                      onClick={() => {
                        if (active) return;
                        hapticMap.selection();
                        setValue("releaseType", rt, {
                          shouldValidate: true,
                          shouldDirty: true,
                          shouldTouch: true
                        });
                      }}
                      aria-pressed={active}
                      className="omf-focus omf-press relative min-h-[48px] flex-1 rounded-control border border-omf-line-strong text-[15px]"
                    >
                      {active ? (
                        <motion.span
                          layoutId="release-type-pill"
                          className="absolute -inset-px rounded-control bg-omf-ink"
                          transition={{ type: "spring", stiffness: 520, damping: 40 }}
                          aria-hidden
                        />
                      ) : null}
                      <span
                        className={`relative transition-colors duration-200 ${
                          active ? "font-bold text-omf-bg" : "font-medium text-omf-graphite hover:text-omf-ink"
                        }`}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <FormFieldError message={errors.releaseType?.message} />
            </div>

            <div className="space-y-4">
              <div className="min-w-0 space-y-1.5">
                <label
                  className={`mb-2.5 flex items-center gap-2 ${WIZARD_FIELD_LABEL_CLASS}`}
                >
                  <Calendar className="h-3.5 w-3.5 text-omf-faint" strokeWidth={1.5} aria-hidden />
                  Плановая дата релиза
                </label>
                <div
                  className={`${GLASS_DATE_WRAP_BASE} ${borderForDateWrap(
                    Boolean(errors.releaseDate),
                    touchedFields.releaseDate,
                    dirtyFields.releaseDate
                  )}`}
                >
                  <input
                    type="date"
                    min={minReleaseDate}
                    {...register("releaseDate")}
                    className="glass-date-native cursor-pointer bg-transparent text-[16px] text-omf-ink [color-scheme:dark]"
                  />
                </div>
                <FormFieldError message={errors.releaseDate?.message} />
              </div>
              {isEarlyReleaseDate && (
                <p className="rounded-control border border-omf-line-strong px-3 py-2.5 text-[13px] leading-relaxed text-omf-graphite">
                  Если выпустить раньше чем через 2 недели, шансов попасть в редакционные плейлисты меньше. Лучше выбрать дату позже.
                </p>
              )}
              <div className="min-w-0 space-y-1.5">
                <label className={`mb-2.5 block ${WIZARD_FIELD_LABEL_CLASS}`}>
                  Лейбл
                </label>
                <div
                  className={`${WIZARD_INPUT_CLASS} cursor-not-allowed text-omf-graphite`}
                  aria-readonly="true"
                >
                  {FIXED_RELEASE_LABEL}
                </div>
                <input type="hidden" {...register("label")} />
                <p className="text-[13px] leading-relaxed text-omf-faint">
                  Лейбл задан сервисом, поменять его нельзя.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="pt-2 text-[17px] font-semibold text-omf-ink">Авторство и права</p>
              <div className="min-w-0 space-y-1.5">
                <label className={`mb-2.5 block ${WIZARD_FIELD_LABEL_CLASS}`}>
                  ФИО артиста
                </label>
                <Controller
                  name="authorFullName"
                  control={control}
                  render={({ field }) => (
                    <input
                      name={field.name}
                      ref={field.ref}
                      value={typeof field.value === "string" ? field.value : ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      className={`${WIZARD_INPUT_CLASS} ${borderForField(
                        Boolean(errors.authorFullName),
                        touchedFields.authorFullName,
                        dirtyFields.authorFullName
                      )}`}
                      placeholder="Иванов Иван Иванович"
                      autoComplete="off"
                    />
                  )}
                />
                <FormFieldError message={errors.authorFullName?.message} />
                <p className="text-[13px] leading-relaxed text-omf-faint">Как в паспорте. Если артистов несколько, перечислите через запятую.</p>
              </div>

              <div className="min-w-0 space-y-1.5">
                <label className={`mb-2.5 block ${WIZARD_FIELD_LABEL_CLASS}`}>
                  Автор бита
                </label>
                <Controller
                  name="musicAuthor"
                  control={control}
                  render={({ field }) => (
                    <input
                      name={field.name}
                      ref={field.ref}
                      value={typeof field.value === "string" ? field.value : ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      className={`${WIZARD_INPUT_CLASS} ${borderForField(
                        Boolean(errors.musicAuthor),
                        touchedFields.musicAuthor,
                        dirtyFields.musicAuthor
                      )}`}
                      placeholder="Ник или ФИО битмейкера"
                      autoComplete="off"
                    />
                  )}
                />
                <FormFieldError message={errors.musicAuthor?.message} />
              </div>

              <MetadataSelectField
                label="Условия использования бита"
                Icon={FileSignature}
                errorMessage={errors.licenseType?.message}
                {...register("licenseType")}
                selectClassName={borderForField(
                  Boolean(errors.licenseType),
                  touchedFields.licenseType,
                  dirtyFields.licenseType
                )}
              >
                <option value="" disabled hidden>
                  —
                </option>
                {LICENSE_TYPE_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {LICENSE_TYPE_LABELS[v]}
                  </option>
                ))}
              </MetadataSelectField>

              <div className="min-w-0 space-y-1.5">
                <label className={`mb-2.5 flex items-center gap-2 ${WIZARD_FIELD_LABEL_CLASS}`}>
                  <Timer className="h-3.5 w-3.5 text-omf-faint" aria-hidden />
                  Начало отрывка для TikTok
                </label>
                <Controller
                  name="tiktokStart"
                  control={control}
                  render={({ field }) => (
                    <input
                      name={field.name}
                      ref={field.ref}
                      value={typeof field.value === "string" ? field.value : ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      inputMode="text"
                      className={`${WIZARD_INPUT_CLASS} ${borderForField(
                        Boolean(errors.tiktokStart),
                        touchedFields.tiktokStart,
                        dirtyFields.tiktokStart
                      )}`}
                      placeholder="0:45"
                      autoComplete="off"
                    />
                  )}
                />
                <FormFieldError message={errors.tiktokStart?.message} />
                <p className="text-[13px] leading-relaxed text-omf-faint">С какого момента трека начинать 60-секундный фрагмент для TikTok и Reels.</p>
              </div>
            </div>

            <ArtistProfileLinksSection />

            <button
              type="submit"
              disabled={!canProceed || isSubmitting}
              className="create-flow-submit-target omf-btn-primary mt-1 h-14 w-full text-[16px]"
            >
              {isSubmitting ? "Сохраняем…" : "Дальше: обложка"}
            </button>
          </form>
        )}
      </div>
    </CreateShell>
  );
}

export default function CreateMetadataPage() {
  return (
    <Suspense fallback={null}>
      <CreateMetadataPageInner />
    </Suspense>
  );
}

