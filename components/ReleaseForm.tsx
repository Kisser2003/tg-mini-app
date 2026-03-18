"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileUploader } from "./FileUploader";
import { getTelegramWebApp } from "@/lib/telegram";
import { useTelegramMainButton } from "@/lib/useTelegramMainButton";

const artistRoleEnum = z.enum(["primary", "featuring"]);

const artistSchema = z.object({
  name: z.string().min(1, "Укажите имя артиста"),
  role: artistRoleEnum
});

const releaseStepOneSchema = z.object({
  // паспорт релиза
  releaseTitle: z.string().min(1, "Укажите название релиза"),
  releaseType: z.enum(["single", "ep", "album"]),
  genre: z.string().min(1, "Выберите основной жанр"),
  subgenre: z.string().default(""),
  language: z.string().default(""),
  label: z.string().default(""),
  // артисты релиза
  artists: z.array(artistSchema).min(1, "Добавьте хотя бы одного артиста"),
  // дата и флаги
  releaseDate: z
    .string()
    .min(1, "Укажите дату релизного издания")
    .refine((value) => {
      if (!value) return false;
      const selected = new Date(`${value}T00:00:00`);
      if (Number.isNaN(selected.getTime())) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minDate = new Date(today);
      minDate.setDate(minDate.getDate() + 5);

      return selected >= minDate;
    }, "Дата релизного издания должна быть не раньше чем через 5 дней от сегодняшней даты"),
  explicit: z.boolean()
});

export type ReleaseStepOneValues = z.input<typeof releaseStepOneSchema>;

type ReleaseFormProps = {
  onSubmitted: (summary: { artistName: string; trackName: string }) => void;
  onSubmitRelease: (args: {
    form: ReleaseStepOneValues;
    artworkFile: File;
  }) => Promise<"success" | "tracks">;
  isSubmitting?: boolean;
  submitError?: string | null;
  initialValues?: Partial<ReleaseStepOneValues>;
  onChangeValues?: (values: ReleaseStepOneValues) => void;
};

export function ReleaseForm({
  onSubmitted,
  onSubmitRelease,
  isSubmitting,
  submitError,
  initialValues,
  onChangeValues
}: ReleaseFormProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid, isDirty }
  } = useForm<ReleaseStepOneValues>({
    resolver: zodResolver(releaseStepOneSchema),
    mode: "onChange",
    defaultValues: {
      releaseTitle: initialValues?.releaseTitle ?? "",
      releaseType: initialValues?.releaseType ?? "single",
      genre: initialValues?.genre ?? "",
      subgenre: initialValues?.subgenre ?? "",
      language: initialValues?.language ?? "",
      label: initialValues?.label ?? "",
      artists: initialValues?.artists ?? [{ name: "", role: "primary" }],
      releaseDate: initialValues?.releaseDate ?? "",
      explicit: initialValues?.explicit ?? false
    }
  });

  const { fields: artistFields, append: appendArtist, remove: removeArtist } = useFieldArray({
    control,
    name: "artists"
  });

  const values = watch();
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [invalidShake, setInvalidShake] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

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

  useEffect(() => {
    const primaryArtist = values.artists?.[0]?.name;
    if (primaryArtist && !values.label) {
      setValue("label", primaryArtist, { shouldValidate: false, shouldDirty: true });
    }
  }, [values.artists, values.label, setValue]);

  // синхронизируем значения формы наружу для персиста (дебаунс + только при изменениях)
  useEffect(() => {
    if (!onChangeValues || !isDirty) return;

    const timeoutId = window.setTimeout(() => {
      onChangeValues(values);
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [values, onChangeValues, isDirty]);

  const onValidSubmit = useCallback(
    async (data: ReleaseStepOneValues) => {
      setSubmitAttempted(true);

      if (!artworkFile) {
        setInvalidShake(true);
        setTimeout(() => setInvalidShake(false), 220);
        try {
          getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.("error");
        } catch {}
        return;
      }

      let result: "success" | "tracks";

      try {
        result = await onSubmitRelease({
          form: data,
          artworkFile
        });
      } catch {
        // ошибка уже отображается выше по дереву
        return;
      }

      if (result === "tracks") {
        // дальнейшая навигация обрабатывается на уровне родителя
        return;
      }

      try {
        getTelegramWebApp()?.HapticFeedback?.impactOccurred?.("light");
      } catch {}

      onSubmitted({
        artistName: data.artists[0]?.name ?? "",
        trackName: data.releaseTitle
      });
    },
    [artworkFile, onSubmitRelease, onSubmitted]
  );

  const onInvalidSubmit = useCallback(() => {
    setSubmitAttempted(true);
    setInvalidShake(true);
    setTimeout(() => setInvalidShake(false), 220);
    try {
      getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.("error");
    } catch {}
  }, []);

  const isNextEnabled = !isSubmitting;

  const cardVariants = {
    hidden: {
      opacity: 0,
      scale: 0.9,
      filter: "blur(10px)"
    },
    visible: (index: number) => ({
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        delay: 0.05 * index,
        duration: 0.4,
        ease: "easeOut"
      }
    })
  };

  const handleMainButtonClick = useCallback(() => {
    // программно триггерим сабмит формы
    void handleSubmit(onValidSubmit, onInvalidSubmit)();
  }, [handleSubmit, onValidSubmit, onInvalidSubmit]);

  useTelegramMainButton({
    text: isSubmitting ? "Отправка..." : "Далее",
    enabled: isValid && !isSubmitting,
    loading: Boolean(isSubmitting),
    onClick: handleMainButtonClick
  });

  return (
    <div className="min-h-screen bg-black px-4 py-5 pb-10 text-white">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-5 font-sans">
        <header className="space-y-1">
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight">
            Релиз · Шаг 1 · Паспорт
          </h1>
          <p className="text-[13px] text-white/60 leading-relaxed">
            Основная информация о релизе и обложка. Аудио загружаются на следующем шаге.
          </p>
        </header>

        <form
          onSubmit={handleSubmit(onValidSubmit, onInvalidSubmit)}
          className="flex flex-col gap-4"
        >
          <motion.div
            custom={0}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.75)] backdrop-blur-2xl"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FileUploader
                label="Artwork (JPG/PNG)"
                accept=".jpg,.jpeg,.png"
                maxSizeMb={20}
                type="cover"
                onFileChange={setArtworkFile}
              />
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 text-[11px]">
              {submitAttempted && !artworkFile && (
                <p className="text-red-400">Загрузите обложку (JPG/PNG).</p>
              )}
            </div>
          </motion.div>

          <motion.div
            custom={1}
            initial="hidden"
            animate={invalidShake ? "invalid" : "visible"}
            variants={{
              ...cardVariants,
              invalid: {
                ...cardVariants.visible(1),
                x: [0, -4, 4, -3, 3, -2, 2, 0],
                boxShadow: [
                  "0 18px 40px rgba(0,0,0,0.75)",
                  "0 0 0 0 rgba(248,113,113,0.6)",
                  "0 0 0 6px rgba(248,113,113,0.35)",
                  "0 0 0 0 rgba(248,113,113,0)"
                ],
                transition: {
                  duration: 0.5,
                  ease: "easeOut"
                }
              }
            }}
            className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.75)] backdrop-blur-2xl"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                    Артисты
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      appendArtist({
                        name: "",
                        role: "featuring"
                      })
                    }
                    className="text-[11px] font-medium text-[#A5B4FC]"
                  >
                    + Добавить
                  </button>
                </div>

                <div className="space-y-2">
                  {artistFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex flex-col gap-2 rounded-[16px] bg-black/60 px-3 py-2.5 border border-white/10 sm:flex-row sm:items-center"
                    >
                      <input
                        {...register(`artists.${index}.name` as const)}
                        placeholder={
                          index === 0 ? "Основной артист" : "Feat / Remixer"
                        }
                        className="w-full flex-1 bg-transparent text-[14px] text-white placeholder:text-white/30 outline-none"
                      />
                      <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
                        <select
                          {...register(`artists.${index}.role` as const)}
                          className="h-8 w-full max-w-[120px] rounded-[999px] border border-white/15 bg-white/5 px-3 text-[11px] text-white/80 outline-none transition-colors focus:border-[#4F46E5] focus:bg-white/10 sm:w-auto"
                        >
                          <option value="primary">Primary</option>
                          <option value="featuring">Featuring</option>
                        </select>
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => removeArtist(index)}
                            className="text-[11px] text-white/40 self-end sm:self-auto"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {errors.artists && (
                  <p className="mt-0.5 text-[11px] text-red-400">
                    {errors.artists.message as string}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Название релиза
                </label>
                <input
                  {...register("releaseTitle")}
                  placeholder="Основное название релиза без лишних символов"
                  className="h-[56px] w-full rounded-[18px] border border-white/10 bg-black/60 px-4 text-[15px] sm:text-[16px] text-white placeholder:text-white/30 outline-none focus:border-[#4F46E5]"
                />
                {errors.releaseTitle && (
                  <p className="mt-0.5 text-[11px] text-red-400">
                    {errors.releaseTitle.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Тип релиза
                </label>
                <div className="relative mt-1 flex h-[56px] w-full items-center justify-between rounded-[18px] border border-white/10 bg-black/60 px-1.5 text-[13px] text-white">
                  <motion.div
                    layoutId="release-type-active-pill"
                    className="absolute inset-y-1 rounded-[16px] bg-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.55)]"
                    initial={false}
                    animate={{
                      left:
                        values.releaseType === "ep"
                          ? "33.33%"
                          : values.releaseType === "album"
                          ? "66.66%"
                          : "0%",
                      width: "33.33%"
                    }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                  {[
                    { key: "single", label: "Single" },
                    { key: "ep", label: "EP" },
                    { key: "album", label: "Album" }
                  ].map((option) => {
                    const isActive = values.releaseType === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setValue("releaseType", option.key as any, {
                            shouldValidate: true
                          });
                          try {
                            getTelegramWebApp()?.HapticFeedback?.impactOccurred?.(
                              "light"
                            );
                          } catch {}
                        }}
                        className={`relative z-[1] flex-1 rounded-[16px] px-2 text-center text-[13px] font-medium transition-colors ${
                          isActive ? "text-white" : "text-white/45"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {errors.releaseType && (
                  <p className="mt-0.5 text-[11px] text-red-400">
                    {errors.releaseType.message}
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            custom={2}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.75)] backdrop-blur-2xl"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Жанр
                </label>
                <select
                  {...register("genre")}
                  onChange={(e) => {
                    register("genre").onChange(e);
                    try {
                      getTelegramWebApp()?.HapticFeedback?.impactOccurred?.("light");
                    } catch {}
                  }}
                  className="h-[56px] w-full rounded-[18px] border border-white/10 bg-black/60 px-4 text-[15px] text-white outline-none [color-scheme:dark] focus:border-[#4F46E5]"
                >
                  <option value="">Выберите жанр</option>
                  <option value="Techno">Techno</option>
                  <option value="House">House</option>
                  <option value="Hip-hop">Hip-hop</option>
                  <option value="Pop">Pop</option>
                  <option value="Electronic">Electronic</option>
                  <option value="Other">Другое</option>
                </select>
                {errors.genre && (
                  <p className="mt-0.5 text-[11px] text-red-400">
                    {errors.genre.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Дата релиса
                </label>
                <input
                  type="date"
                  {...register("releaseDate")}
                  onChange={(e) => {
                    register("releaseDate").onChange(e);
                    try {
                      getTelegramWebApp()?.HapticFeedback?.impactOccurred?.("light");
                    } catch {}
                  }}
                  min={minReleaseDate}
                  className="h-[56px] w-full rounded-[18px] border border-white/10 bg-black/60 px-4 text-[15px] text-white outline-none [color-scheme:dark] focus:border-[#4F46E5]"
                />
                {errors.releaseDate && (
                  <p className="mt-0.5 text-[11px] text-red-400">
                    {errors.releaseDate.message}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Поджанр
                </label>
                <input
                  {...register("subgenre")}
                  placeholder="Например, Melodic Techno"
                  className="h-[48px] w-full rounded-[16px] border border-white/10 bg-black/60 px-4 text-[14px] sm:text-[15px] text-white placeholder:text-white/30 outline-none focus:border-[#4F46E5]"
                />
              </div>
            </div>
          </motion.div>

          <motion.div
            custom={3}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.75)] backdrop-blur-2xl"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Язык
                </label>
                <input
                  {...register("language")}
                  placeholder="Например, English / Russian"
                  className="h-[48px] w-full rounded-[16px] border border-white/10 bg-black/60 px-4 text-[14px] sm:text-[15px] text-white placeholder:text-white/30 outline-none focus:border-[#4F46E5]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Лейбл
                </label>
                <input
                  {...register("label")}
                  placeholder="Название лейбла или артиста"
                  className="h-[48px] w-full rounded-[16px] border border-white/10 bg-black/60 px-4 text-[14px] sm:text-[15px] text-white placeholder:text-white/30 outline-none focus:border-[#4F46E5]"
                />
              </div>
            </div>
          </motion.div>

          <motion.div
            custom={3}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.75)] backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-[13px] font-medium">Explicit (18+)</p>
                <p className="text-[11px] text-white/50">
                  Отметьте, если в тексте есть ненормативная лексика.
                </p>
              </div>
              <button
                type="button"
                aria-label="Ненормативная лексика"
                onClick={() => {
                  setValue("explicit", !values.explicit, { shouldValidate: true });
                  try {
                    getTelegramWebApp()?.HapticFeedback?.impactOccurred?.("light");
                  } catch {}
                }}
                className={`inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full px-[3px] transition-colors ${
                  values.explicit ? "bg-[#EF4444]" : "bg-white/20"
                }`}
              >
                <motion.span
                  layout
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30
                  }}
                  animate={{
                    x: values.explicit ? 18 : 0,
                    scaleX: values.explicit ? 1.12 : 1,
                    scaleY: values.explicit ? 0.9 : 1
                  }}
                  className="h-5 w-5 rounded-full bg-white"
                />
              </button>
            </div>
          </motion.div>

          <motion.button
            type="submit"
            whileHover={{ scale: isNextEnabled ? 1.02 : 1 }}
            whileTap={{ scale: isNextEnabled ? 0.96 : 1 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 28
            }}
            disabled={!isNextEnabled}
            className="mt-3 inline-flex h-[60px] w-full items-center justify-center rounded-[20px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[17px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.6)] transition-all disabled:opacity-60 disabled:shadow-none"
          >
            {isSubmitting ? "Отправка..." : "Далее"}
          </motion.button>

          {submitError && (
            <p className="mt-2 text-center text-[11px] text-red-400">{submitError}</p>
          )}

          <p className="mt-6 text-center text-[10px] uppercase tracking-[0.22em] text-white/25">
            © 2026 OMF DISTRIBUTION
          </p>
        </form>
      </div>
    </div>
  );
}

