"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileUploader } from "./FileUploader";

const artistRoleEnum = z.enum(["main", "feat", "remixer"]);

const artistSchema = z.object({
  name: z.string().min(1, "Укажите имя артиста"),
  role: artistRoleEnum
});

const releaseStepOneSchema = z.object({
  artists: z.array(artistSchema).min(1, "Добавьте хотя бы одного артиста"),
  trackName: z.string().min(1, "Укажите название трека"),
  releaseType: z.enum(["single", "ep", "album"]),
  mainGenre: z.string().min(1, "Выберите жанр"),
  releaseDate: z.string().min(1, "Укажите дату релиса"),
  rightHolder: z.string().min(1, "Укажите правообладателя"),
  explicit: z.boolean()
});

type ReleaseStepOneValues = z.infer<typeof releaseStepOneSchema>;

type ReleaseFormProps = {
  onSubmitted: (summary: { artistName: string; trackName: string }) => void;
};

export function ReleaseForm({ onSubmitted }: ReleaseFormProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid }
  } = useForm<ReleaseStepOneValues>({
    resolver: zodResolver(releaseStepOneSchema),
    mode: "onChange",
    defaultValues: {
      artists: [{ name: "", role: "main" }],
      trackName: "",
      releaseType: undefined,
      mainGenre: "",
      releaseDate: "",
      rightHolder: "",
      explicit: false
    }
  });

  const { fields: artistFields, append: appendArtist, remove: removeArtist } = useFieldArray({
    control,
    name: "artists"
  });

  const values = watch();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [invalidShake, setInvalidShake] = useState(false);
  const [rightHolderTouched, setRightHolderTouched] = useState(false);

  useEffect(() => {
    const mainArtistName = values.artists?.[0]?.name;
    if (!rightHolderTouched && mainArtistName && !values.rightHolder) {
      setValue("rightHolder", mainArtistName, { shouldValidate: true });
    }
  }, [values.artists, values.rightHolder, rightHolderTouched, setValue]);

  const onValidSubmit = (data: ReleaseStepOneValues) => {
    if (!audioFile || !artworkFile) {
      setInvalidShake(true);
      setTimeout(() => setInvalidShake(false), 220);
      try {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
      } catch {}
      return;
    }

    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    } catch {}

    onSubmitted({
      artistName: data.artists[0]?.name ?? "",
      trackName: data.trackName
    });
  };

  const onInvalidSubmit = () => {
    setInvalidShake(true);
    setTimeout(() => setInvalidShake(false), 220);
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
    } catch {}
  };

  const isNextEnabled = isValid && Boolean(audioFile) && Boolean(artworkFile);

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

  return (
    <div className="min-h-screen bg-black px-4 py-5 pb-10 text-white">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-5 font-sans">
        <header className="space-y-1">
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight">
            Релиз · Шаг 1
          </h1>
          <p className="text-[13px] text-white/60 leading-relaxed">
            Минимальный набор данных, чтобы начать оформление релиза.
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
            <div className="grid grid-cols-2 gap-3">
              <FileUploader
                label="Audio (WAV)"
                accept=".wav"
                maxSizeMb={200}
                type="wav"
                onFileChange={setAudioFile}
              />
              <FileUploader
                label="Artwork (JPG/PNG)"
                accept=".jpg,.jpeg,.png"
                maxSizeMb={20}
                type="cover"
                onFileChange={setArtworkFile}
              />
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
                        role: "feat"
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
                      className="flex items-center gap-2 rounded-[16px] bg-black/60 px-3 py-2.5 border border-white/10"
                    >
                      <input
                        {...register(`artists.${index}.name` as const)}
                        placeholder={
                          index === 0 ? "Основной артист" : "Feat / Remixer"
                        }
                        className="flex-1 bg-transparent text-[14px] text-white placeholder:text-white/40 outline-none"
                      />
                      <select
                        {...register(`artists.${index}.role` as const)}
                        className="h-8 rounded-[999px] bg-white/10 px-2 text-[11px] text-white outline-none"
                      >
                        <option value="main">Main</option>
                        <option value="feat">Feat.</option>
                        <option value="remixer">Remixer</option>
                      </select>
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => removeArtist(index)}
                          className="text-[11px] text-white/40"
                        >
                          ✕
                        </button>
                      )}
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
                  Правообладатель (ФИО / Лейбл)
                </label>
                <input
                  {...register("rightHolder")}
                  placeholder="Фамилия Имя Отчество или название компании"
                  onBlur={() => setRightHolderTouched(true)}
                  className="h-[56px] w-full rounded-[18px] border border-white/10 bg-black/60 px-4 text-[16px] text-white placeholder:text-white/40 outline-none focus:border-[#4F46E5]"
                />
                {errors.rightHolder && (
                  <p className="mt-0.5 text-[11px] text-red-400">
                    {errors.rightHolder.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Название трека
                </label>
                <input
                  {...register("trackName")}
                  placeholder="Основное название без лишних символов"
                  className="h-[56px] w-full rounded-[18px] border border-white/10 bg-black/60 px-4 text-[16px] text-white placeholder:text-white/40 outline-none focus:border-[#4F46E5]"
                />
                {errors.trackName && (
                  <p className="mt-0.5 text-[11px] text-red-400">
                    {errors.trackName.message}
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
                            window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Основной жанр
                </label>
                <select
                  {...register("mainGenre")}
                  onChange={(e) => {
                    register("mainGenre").onChange(e);
                    try {
                      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
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
                {errors.mainGenre && (
                  <p className="mt-0.5 text-[11px] text-red-400">
                    {errors.mainGenre.message}
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
                      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
                    } catch {}
                  }}
                  className="h-[56px] w-full rounded-[18px] border border-white/10 bg-black/60 px-4 text-[15px] text-white outline-none [color-scheme:dark] focus:border-[#4F46E5]"
                />
                {errors.releaseDate && (
                  <p className="mt-0.5 text-[11px] text-red-400">
                    {errors.releaseDate.message}
                  </p>
                )}
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
                    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
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
            Далее
          </motion.button>

          <p className="mt-6 text-center text-[10px] uppercase tracking-[0.22em] text-white/25">
            © 2026 OMF DISTRIBUTION
          </p>
        </form>
      </div>
    </div>
  );
}

