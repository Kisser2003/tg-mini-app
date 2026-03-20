"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { CreateShell } from "@/features/release/createRelease/components/CreateShell";
import { metadataSchema } from "@/features/release/createRelease/schemas";
import type { CreateMetadata } from "@/features/release/createRelease/types";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import { hydrateFromReleaseId, initUserContextInStore } from "@/features/release/createRelease/actions";
import { triggerHaptic } from "@/lib/telegram";

const fieldErr =
  "border border-red-500/45 ring-1 ring-red-500/30 focus:border-red-400/60 focus:ring-red-400/25";

function CreateMetadataPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const releaseIdParam = searchParams.get("releaseId");

  const storeMetadata = useCreateReleaseDraftStore((s) => s.metadata);
  const setMetadata = useCreateReleaseDraftStore((s) => s.setMetadata);

  const [isHydrating, setIsHydrating] = useState(Boolean(releaseIdParam));
  const [hydrateError, setHydrateError] = useState<string | null>(null);

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

  const defaultValues: CreateMetadata = useMemo(() => storeMetadata, [storeMetadata]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid, isDirty, dirtyFields }
  } = useForm<CreateMetadata>({
    resolver: zodResolver(metadataSchema),
    mode: "onChange",
    defaultValues
  });

  const { fields: artistFields, append, remove } = useFieldArray({
    control,
    name: "artists"
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
    const primaryArtist = values.artists?.[0]?.name;
    if (primaryArtist && !values.label) {
      setValue("label", primaryArtist, { shouldValidate: false, shouldDirty: true });
    }
  }, [setValue, values.artists, values.label]);

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

  const onSubmit = useCallback(async (data: CreateMetadata) => {
    triggerHaptic("light");
    setMetadata(data);
    router.push("/create/assets");
  }, [router, setMetadata]);

  return (
    <CreateShell title="Релиз · Паспорт">
      <div className="rounded-[24px] border border-white/[0.08] bg-surface/80 px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
        {isHydrating ? (
          <p className="text-[13px] text-text-muted">Загружаем данные релиза…</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {hydrateError && (
              <p className="rounded-[14px] border border-red-500/30 bg-red-950/40 px-3 py-2 text-[12px] text-red-100">
                {hydrateError}
              </p>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Артисты
                </span>
                <button
                  type="button"
                  onClick={() => append({ name: "", role: "featuring" })}
                  className="text-[11px] font-medium text-[#A5B4FC]"
                >
                  + Добавить
                </button>
              </div>
              <div className="space-y-2">
                {artistFields.map((field, idx) => (
                  <div
                    key={field.id}
                    className={`flex flex-col gap-2 rounded-[16px] bg-black/40 px-3 py-2.5 sm:flex-row sm:items-center ${
                      errors.artists?.[idx]?.name && dirtyFields.artists?.[idx]?.name
                        ? "ring-1 ring-red-500/35"
                        : ""
                    }`}
                  >
                    <input
                      {...register(`artists.${idx}.name` as const)}
                      placeholder={idx === 0 ? "Основной артист" : "Feat / Remixer"}
                      className={`w-full flex-1 bg-transparent text-[16px] text-white placeholder:text-white/30 outline-none ${
                        errors.artists?.[idx]?.name && dirtyFields.artists?.[idx]?.name
                          ? fieldErr
                          : ""
                      }`}
                    />
                    <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
                      <select
                        {...register(`artists.${idx}.role` as const)}
                        className="h-8 w-full max-w-[120px] rounded-[999px] bg-black/60 px-3 text-[16px] text-white/80 outline-none transition-colors [color-scheme:dark] focus:bg-black/80 sm:w-auto"
                      >
                        <option value="primary">Primary</option>
                        <option value="featuring">Featuring</option>
                      </select>
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => remove(idx)}
                          className="text-[11px] text-white/40 self-end sm:self-auto"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {errors.artists?.[idx]?.name && dirtyFields.artists?.[idx]?.name && (
                      <p className="w-full text-[11px] text-red-400 sm:order-last">
                        {errors.artists[idx]?.name?.message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {errors.artists?.root && (
                <p className="text-[11px] text-red-400">{errors.artists.root.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                Название релиза
              </label>
              <input
                {...register("releaseTitle")}
                className={`h-[56px] w-full rounded-[18px] bg-black/40 px-4 text-[16px] text-white placeholder:text-white/30 outline-none transition-colors focus:bg-black/60 ${
                  errors.releaseTitle && dirtyFields.releaseTitle ? fieldErr : ""
                }`}
                placeholder="Основное название релиза"
              />
              {errors.releaseTitle && (
                <p className="text-[11px] text-red-400">{errors.releaseTitle.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Тип релиза
                </label>
                <select
                  {...register("releaseType")}
                  className={`h-[56px] w-full rounded-[18px] bg-black/40 px-4 text-[16px] text-white outline-none [color-scheme:dark] transition-colors focus:bg-black/60 ${
                    errors.releaseType && dirtyFields.releaseType ? fieldErr : ""
                  }`}
                >
                  <option value="single">Single</option>
                  <option value="ep">EP</option>
                  <option value="album">Album</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Жанр
                </label>
                <select
                  {...register("genre")}
                  className={`h-[56px] w-full rounded-[18px] bg-black/40 px-4 text-[16px] text-white outline-none [color-scheme:dark] transition-colors focus:bg-black/60 ${
                    errors.genre && dirtyFields.genre ? fieldErr : ""
                  }`}
                >
                  <option value="">Выберите жанр</option>
                  <option value="Techno">Techno</option>
                  <option value="House">House</option>
                  <option value="Hip-hop">Hip-hop</option>
                  <option value="Pop">Pop</option>
                  <option value="Electronic">Electronic</option>
                  <option value="Other">Другое</option>
                </select>
                {errors.genre && <p className="text-[11px] text-red-400">{errors.genre.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Дата релиза
                </label>
                <input
                  type="date"
                  min={minReleaseDate}
                  {...register("releaseDate")}
                  className={`h-[56px] w-full rounded-[18px] bg-black/40 px-4 text-[16px] text-white outline-none [color-scheme:dark] transition-colors focus:bg-black/60 ${
                    errors.releaseDate && dirtyFields.releaseDate ? fieldErr : ""
                  }`}
                />
                {errors.releaseDate && (
                  <p className="text-[11px] text-red-400">{errors.releaseDate.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Лейбл
                </label>
                <input
                  {...register("label")}
                  className={`h-[56px] w-full rounded-[18px] bg-black/40 px-4 text-[16px] text-white outline-none transition-colors focus:bg-black/60 ${
                    errors.label && dirtyFields.label ? fieldErr : ""
                  }`}
                  placeholder="Название лейбла"
                />
                {errors.label && <p className="text-[11px] text-red-400">{errors.label.message}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-[18px] bg-black/40 px-4 py-3">
              <div className="space-y-0.5">
                <p className="text-[13px] font-medium">Explicit (18+)</p>
                <p className="text-[11px] text-white/50">
                  Отметьте, если в тексте есть ненормативная лексика.
                </p>
              </div>
              <button
                type="button"
                aria-label="Ненормативная лексика"
                onClick={() => setValue("explicit", !values.explicit, { shouldValidate: true })}
                className={`inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full px-[3px] transition-colors ${
                  values.explicit ? "bg-[#EF4444]" : "bg-white/20"
                }`}
              >
                <motion.span
                  layout
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  animate={{ x: values.explicit ? 18 : 0 }}
                  className="h-5 w-5 rounded-full bg-white"
                />
              </button>
            </div>

            <button
              type="submit"
              disabled={!isValid}
              className="mt-1 inline-flex h-[56px] w-full items-center justify-center rounded-[20px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[16px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.6)] disabled:opacity-60 disabled:shadow-none"
            >
              Далее
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

