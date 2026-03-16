"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { FileUploader } from "./FileUploader";

type FormValues = {
  artistName: string;
  trackName: string;
  genre: string;
  releaseDate: string;
  mood: string;
  language: string;
  explicit: boolean;
};

type ReleaseFormProps = {
  onSubmitted: () => void;
};

export function ReleaseForm({ onSubmitted }: ReleaseFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<FormValues>({
    defaultValues: {
      artistName: "",
      trackName: "",
      genre: "",
      releaseDate: "",
      mood: "",
      language: "",
      explicit: false
    }
  });

  const values = watch();
  const [submitting, setSubmitting] = useState(false);
  const [invalidShake, setInvalidShake] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const onValidSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      onSubmitted();
    }, 800);
  };

  const onInvalidSubmit = () => {
    setInvalidShake(true);
    setTimeout(() => setInvalidShake(false), 250);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-5 pb-8 text-text">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-6 font-sans">
        <header className="space-y-2">
          <h1 className="text-[32px] font-extrabold tracking-tight leading-tight">
            Новый релиз
          </h1>
          <p className="text-[15px] text-text-muted leading-relaxed">
            Создай профессиональный пак для дистрибуции
          </p>
        </header>

        <form
          onSubmit={handleSubmit(onValidSubmit, onInvalidSubmit)}
          className="flex flex-col gap-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={
              invalidShake
                ? { x: [0, -6, 6, -4, 4, 0] }
                : { x: 0, opacity: 1, y: 0 }
            }
            transition={{ duration: invalidShake ? 0.25 : 0.2 }}
            className="rounded-[24px] border border-white/5 bg-surface/80 px-6 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
                  Имя артиста
                </label>
                <motion.input
                  {...register("artistName", { required: "Укажите имя артиста" })}
                  placeholder="Введите имя артиста"
                  onFocus={() => setFocusedField("artistName")}
                  onBlur={() => setFocusedField((prev) => (prev === "artistName" ? null : prev))}
                  animate={
                    focusedField === "artistName"
                      ? {
                          scale: 1.01,
                          boxShadow: "0 0 0 2px rgba(0,122,255,0.2)"
                        }
                      : { scale: 1, boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
                  }
                  transition={{ duration: 0.12 }}
                  className="h-14 w-full rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[15px] text-white placeholder:text-text-muted outline-none focus:border-primary focus:ring-0"
                />
                {errors.artistName && (
                  <p className="mt-1 text-[11px] text-red-400">
                    {errors.artistName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
                  Название трека
                </label>
                <motion.input
                  {...register("trackName", {
                    required: "Укажите название трека"
                  })}
                  placeholder="Введите название трека"
                  onFocus={() => setFocusedField("trackName")}
                  onBlur={() => setFocusedField((prev) => (prev === "trackName" ? null : prev))}
                  animate={
                    focusedField === "trackName"
                      ? {
                          scale: 1.01,
                          boxShadow: "0 0 0 2px rgba(0,122,255,0.2)"
                        }
                      : { scale: 1, boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
                  }
                  transition={{ duration: 0.12 }}
                  className="h-14 w-full rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[15px] text-white placeholder:text-text-muted outline-none focus:border-primary focus:ring-0"
                />
                {errors.trackName && (
                  <p className="mt-1 text-[11px] text-red-400">
                    {errors.trackName.message}
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-[24px] border border-white/5 bg-surface/80 px-6 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <div className="mb-4 flex gap-3">
              <div className="flex-1 space-y-2">
                <label className="block text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
                  Жанр
                </label>
                <select
                  {...register("genre", { required: "Выберите жанр" })}
                  className="h-14 w-full rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[15px] text-white outline-none focus:border-primary"
                >
                  <option value="">Выберите жанр</option>
                  <option value="Techno">Техно</option>
                  <option value="House">Хаус</option>
                  <option value="Hip-hop">Хип-хоп</option>
                  <option value="Pop">Поп</option>
                  <option value="Electronic">Электронная</option>
                  <option value="Other">Другое</option>
                </select>
                {errors.genre && (
                  <p className="text-[11px] text-red-400 mt-1">
                    {errors.genre.message}
                  </p>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <label className="block text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
                  Дата релиза
                </label>
                <input
                  type="date"
                  {...register("releaseDate", {
                    required: "Укажите дату релиза"
                  })}
                  className="h-14 w-full rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[15px] text-white outline-none [color-scheme:dark] focus:border-primary"
                />
                {errors.releaseDate && (
                  <p className="text-[11px] text-red-400 mt-1">
                    {errors.releaseDate.message}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-4 flex gap-3">
              <div className="flex-1 space-y-2">
                <label className="block text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
                  Настроение / Вайб
                </label>
                <select
                  {...register("mood", { required: "Выберите настроение" })}
                  className="h-14 w-full rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[15px] text-white outline-none focus:border-primary"
                >
                  <option value="">Выберите настроение</option>
                  <option value="Peak-time">Пиковое время / фестиваль</option>
                  <option value="Dark & hypnotic">Тёмный гипнотик</option>
                  <option value="Melodic">Мелодичный</option>
                  <option value="Deep / minimal">Дип / минимал</option>
                  <option value="Chill / downtempo">Чилл / даунтемпо</option>
                  <option value="Experimental">Экспериментальный</option>
                </select>
                {errors.mood && (
                  <p className="text-[11px] text-red-400 mt-1">
                    {errors.mood.message}
                  </p>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <label className="block text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
                  Язык
                </label>
                <select
                  {...register("language", { required: "Укажите язык" })}
                  className="h-14 w-full rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[15px] text-white outline-none focus:border-primary"
                >
                  <option value="">Выберите язык</option>
                  <option value="Instrumental">Инструментал</option>
                  <option value="Russian">Русский</option>
                  <option value="English">Английский</option>
                  <option value="Spanish">Испанский</option>
                  <option value="German">Немецкий</option>
                  <option value="Other">Другое</option>
                </select>
                {errors.language && (
                  <p className="text-[11px] text-red-400 mt-1">
                    {errors.language.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[15px] font-medium">
                Ненормативная лексика
              </span>
              <button
                type="button"
                onClick={() => setValue("explicit", !values.explicit)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  values.explicit ? "bg-primary" : "bg-zinc-700"
                }`}
              >
                <span
                  className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform ${
                    values.explicit ? "translate-x-[22px]" : "translate-x-[3px]"
                  }`}
                />
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[24px] border border-white/5 bg-surface/80 px-6 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl space-y-4"
          >
            <FileUploader
              label="Трек (WAV)"
              accept=".wav"
              maxSizeMb={200}
              type="wav"
              onFileChange={() => {}}
            />
            <FileUploader
              label="Обложка релиза"
              accept=".jpg,.jpeg,.png"
              maxSizeMb={20}
              type="cover"
              onFileChange={() => {}}
            />
          </motion.div>

          <motion.button
            type="submit"
            whileTap={{ scale: 0.97 }}
            disabled={submitting}
            className="btn-primary mt-2 inline-flex h-[60px] w-full items-center justify-center rounded-[20px] bg-gradient-to-tr from-[#007AFF] to-[#0051FF] text-[17px] font-semibold text-white shadow-[0_10px_30px_rgba(0,122,255,0.45)] transition-all active:scale-[0.97] disabled:opacity-70"
          >
            {submitting ? "Обрабатываем..." : "Сформировать релиз"}
          </motion.button>
        </form>
      </div>
    </div>
  );
}

