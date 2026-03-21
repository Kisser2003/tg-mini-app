"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Calendar, Languages, Mic2 } from "lucide-react";
import { motion } from "framer-motion";
import { FormFieldError } from "@/components/FormFieldError";
import { ArtistProfileLinksSection } from "@/features/release/createRelease/components/ArtistProfileLinksSection";
import { ArtistSetupModal } from "@/features/release/createRelease/components/ArtistSetupModal";
import { CreateShell } from "@/features/release/createRelease/components/CreateShell";
import { metadataSchema } from "@/features/release/createRelease/schemas";
import type { CreateMetadata } from "@/features/release/createRelease/types";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import {
  fetchLatestDraftReleaseIdForUser,
  hydrateFromReleaseId,
  initUserContextInStore,
  saveDraftAction
} from "@/features/release/createRelease/actions";
import { logClientError } from "@/lib/logger";
import { firstRhfErrorMessage } from "@/lib/rhf-first-error";
import { MagneticButton } from "@/components/MagneticButton";
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
  GLASS_FIELD_BASE,
  GLASS_FIELD_ERROR_SOFT,
  GLASS_FIELD_ERROR_STRONG
} from "@/lib/glass-form-classes";

const artistInputBase =
  "min-h-[48px] min-w-0 w-full flex-1 rounded-[14px] border border-white/[0.08] bg-black/30 px-4 py-3 text-[16px] leading-normal text-white outline-none transition-[background-color,box-shadow,border-color] duration-200 focus:bg-black/45 focus:ring-2 focus:ring-violet-500/25 focus:ring-offset-0 placeholder:text-white/45";

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
    return "border-amber-500/45 ring-1 ring-amber-400/20";
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
  const setMetadata = useCreateReleaseDraftStore((s) => s.setMetadata);
  const storeTracks = useCreateReleaseDraftStore((s) => s.tracks);
  const artistSetupGateCompleted = useCreateReleaseDraftStore((s) => s.artistSetupGateCompleted);
  const persistedReleaseId = useCreateReleaseDraftStore((s) => s.releaseId);

  const [isHydrating, setIsHydrating] = useState(Boolean(releaseIdParam));
  const [hydrateError, setHydrateError] = useState<string | null>(null);
  const [draftOfferId, setDraftOfferId] = useState<string | null>(null);

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
      const id = await fetchLatestDraftReleaseIdForUser(uid);
      if (!cancelled && id) setDraftOfferId(id);
    })();
    return () => {
      cancelled = true;
    };
  }, [releaseIdParam]);

  const defaultValues: CreateMetadata = useMemo(() => storeMetadata, [storeMetadata]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty, dirtyFields, touchedFields, isSubmitting }
  } = useForm<CreateMetadata>({
    resolver: zodResolver(metadataSchema),
    mode: "onChange",
    defaultValues
  });

  // Post-mount hydration fix: on a hard page-refresh the SSR pass renders with
  // the empty initial store values.  After mounting on the client the persist
  // middleware has already rehydrated from localStorage, so we read the store
  // directly and reset the form once — without marking it dirty.
  const didHydrateRef = useRef(false);
  useEffect(() => {
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;
    const fresh = useCreateReleaseDraftStore.getState().metadata;
    reset(fresh, { keepDirty: false });
  }, [reset]);

  const values = watch();
  const lastSyncedValuesRef = useRef<string>("");

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

  useEffect(() => {
    if (!isDirty) return;
    const serialized = JSON.stringify(values);
    if (serialized === lastSyncedValuesRef.current) return;
    const timeoutId = window.setTimeout(() => {
      setMetadata(values);
      lastSyncedValuesRef.current = serialized;
    }, 200);
    return () => window.clearTimeout(timeoutId);
  }, [values, isDirty, setMetadata]);

  useEffect(() => {
    const primaryArtist = values.primaryArtist?.trim();
    if (primaryArtist && !values.label) {
      setValue("label", primaryArtist, { shouldValidate: false, shouldDirty: true });
    }
  }, [setValue, values.primaryArtist, values.label]);

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
    const saved = await saveDraftAction();
    if (!saved.ok) {
      hapticMap.notificationError();
      toast.error(saved.message);
      return;
    }
    router.push("/create/assets");
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

  const showArtistSetupModal =
    artistSetupGateCompleted === false &&
    !releaseIdParam &&
    !isHydrating &&
    !persistedReleaseId;

  return (
    <CreateShell title="Релиз · Паспорт">
      <ArtistSetupModal open={showArtistSetupModal} />
      <div className="rounded-[24px] border border-white/[0.08] bg-surface/80 px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
        {isHydrating ? (
          <p className="text-[13px] text-text-muted">Загружаем данные релиза…</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-col gap-4">
            {hydrateError && (
              <p className="break-words rounded-[14px] border border-red-500/30 bg-red-950/40 px-3 py-2 text-[12px] leading-relaxed text-red-100">
                {hydrateError}
              </p>
            )}
            {draftOfferId && !isHydrating && (
              <div className="rounded-[14px] border border-sky-500/35 bg-sky-950/40 px-3 py-3 text-[12px] leading-relaxed text-sky-50/95">
                <p className="font-medium text-white">Найден незавершённый черновик</p>
                <p className="mt-1 text-white/70">
                  Продолжить правки или начать новый релиз — локальный черновик сейчас не открыт.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      router.replace(`/create/metadata?releaseId=${draftOfferId}`);
                      setDraftOfferId(null);
                    }}
                    className="rounded-[14px] bg-sky-500/90 px-4 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-sky-500"
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
                      setDraftOfferId(null);
                    }}
                    className="rounded-[14px] border border-white/20 bg-white/5 px-4 py-2 text-[13px] font-medium text-white/85 hover:bg-white/10"
                  >
                    Начать новый
                  </button>
                </div>
              </div>
            )}
            <div className="min-w-0 space-y-1.5">
              <label className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                <Mic2 className="h-3.5 w-3.5 text-white/45" aria-hidden />
                Артист
              </label>
              <input
                {...register("primaryArtist")}
                className={`${artistInputBase} ${borderForField(
                  Boolean(errors.primaryArtist),
                  touchedFields.primaryArtist,
                  dirtyFields.primaryArtist,
                  guidelineFieldFlags.primaryArtist
                )}`}
                placeholder="Имя на обложке"
                autoComplete="off"
              />
              <FormFieldError message={errors.primaryArtist?.message} />
            </div>

            <div className="min-w-0 space-y-1.5">
              <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                Название релиза
              </label>
              <input
                {...register("releaseTitle")}
                className={`${GLASS_FIELD_BASE} ${borderForField(
                  Boolean(errors.releaseTitle),
                  touchedFields.releaseTitle,
                  dirtyFields.releaseTitle,
                  guidelineFieldFlags.releaseTitle
                )}`}
                placeholder="Основное название релиза"
              />
              <FormFieldError message={errors.releaseTitle?.message} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <label className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  <Languages className="h-3.5 w-3.5 text-white/50" aria-hidden />
                  Язык исполнения
                </label>
                <select
                  {...register("language")}
                  className={`${GLASS_FIELD_BASE} [color-scheme:dark] ${borderForField(
                    Boolean(errors.language),
                    touchedFields.language,
                    dirtyFields.language
                  )}`}
                >
                  {PERFORMANCE_LANGUAGE_VALUES.map((code) => (
                    <option key={code} value={code}>
                      {PERFORMANCE_LANGUAGE_LABELS[code]}
                    </option>
                  ))}
                </select>
                <FormFieldError message={errors.language?.message} />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-[12px] border border-white/[0.08] bg-black/35 px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium leading-tight text-white">
                    <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400/90" aria-hidden />
                    Explicit
                  </p>
                  <p className="mt-0.5 text-[9px] leading-snug text-white/40">
                    Для корректного размещения на площадках
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Explicit content"
                  onClick={() => setValue("explicit", !values.explicit, { shouldValidate: true })}
                  className={`inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full px-[2px] transition-colors ${
                    values.explicit ? "bg-[#EF4444]" : "bg-white/20"
                  }`}
                >
                  <motion.span
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    animate={{ x: values.explicit ? 22 : 0 }}
                    className="h-4 w-4 rounded-full bg-white"
                  />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Тип релиза
                </label>
                <select
                  {...register("releaseType")}
                  className={`${GLASS_FIELD_BASE} [color-scheme:dark] ${borderForField(
                    Boolean(errors.releaseType),
                    touchedFields.releaseType,
                    dirtyFields.releaseType
                  )}`}
                >
                  <option value="single">Single</option>
                  <option value="ep">EP</option>
                  <option value="album">Album</option>
                </select>
              </div>
              <div className="min-w-0 space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Жанр
                </label>
                <select
                  {...register("genre")}
                  className={`${GLASS_FIELD_BASE} [color-scheme:dark] ${borderForField(
                    Boolean(errors.genre),
                    touchedFields.genre,
                    dirtyFields.genre
                  )}`}
                >
                  <option value="">Выберите жанр</option>
                  <option value="Techno">Techno</option>
                  <option value="House">House</option>
                  <option value="Hip-hop">Hip-hop</option>
                  <option value="Pop">Pop</option>
                  <option value="Electronic">Electronic</option>
                  <option value="Other">Другое</option>
                </select>
                <FormFieldError message={errors.genre?.message} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="min-w-0 space-y-1.5">
                <label className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  <Calendar className="h-3.5 w-3.5 text-white/45" strokeWidth={1.5} aria-hidden />
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
                    className="glass-date-native cursor-pointer bg-transparent text-[16px] text-white [color-scheme:dark]"
                  />
                  <Calendar
                    className="pointer-events-none ml-auto h-5 w-5 shrink-0 pr-3 text-white/35"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </div>
                <FormFieldError message={errors.releaseDate?.message} />
              </div>
              {isEarlyReleaseDate && (
                <p className="rounded-[12px] border border-sky-500/30 bg-sky-950/35 px-3 py-2.5 text-[11px] leading-relaxed text-sky-100/90">
                  Внимание: при раннем релизе шанс попасть в редакционные плейлисты снижается.
                  Рекомендуем выбирать дату за 2 недели.
                </p>
              )}
              <div className="min-w-0 space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Лейбл
                </label>
                <input
                  {...register("label")}
                  className={`${GLASS_FIELD_BASE} ${borderForField(
                    Boolean(errors.label),
                    touchedFields.label,
                    dirtyFields.label
                  )}`}
                  placeholder="Название лейбла"
                />
                <FormFieldError message={errors.label?.message} />
              </div>
            </div>

            <ArtistProfileLinksSection />

            <MagneticButton
              type="submit"
              disabled={!canProceed || isSubmitting}
              className="mt-1 inline-flex h-[56px] w-full items-center justify-center rounded-[20px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[16px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.6)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {isSubmitting ? "Сохраняем…" : "Далее"}
            </MagneticButton>
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

