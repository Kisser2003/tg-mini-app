"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { FileUploader } from "./FileUploader";
import { supabase } from "../lib/supabase";
import { getTelegramUser } from "../lib/telegram";

const LYRICS_MAX = 5000;

type FormValues = {
  artistName: string;
  authorFullName: string;
  trackName: string;
  genre: string;
  releaseDate: string;
  mood: string;
  language: string;
  lyrics?: string;
  explicit: boolean;
  musicAuthor: string;
  licenseType: string;
  pLine: string;
  cLine: string;
};

type ReleaseFormProps = {
  onSubmitted: (summary: { artistName: string; trackName: string }) => void;
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
      authorFullName: "",
      trackName: "",
      genre: "",
      releaseDate: "",
      mood: "",
      language: "",
      lyrics: "",
      explicit: false,
      musicAuthor: "",
      licenseType: "",
      pLine: "",
      cLine: ""
    }
  });

  const values = watch();
  const [submitting, setSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<"idle" | "uploading" | "saving" | "done">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [invalidShake, setInvalidShake] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [wavFile, setWavFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onValidSubmit = async (data: FormValues) => {
    setSubmitError(null);

    if (!wavFile || !artworkFile) {
      setSubmitError("Пожалуйста, загрузите трек и обложку перед отправкой.");
      setInvalidShake(true);
      setTimeout(() => setInvalidShake(false), 250);
      try {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
      } catch {}
      toast.error("Загрузите трек и обложку");
      return;
    }

    setSubmitting(true);
    setSubmitPhase("uploading");
    setUploadProgress(0);

    try {
      // Telegram user info (если есть)
      const tgUser = getTelegramUser();
      const telegramId = tgUser?.id ?? null;
      const telegramUsername = tgUser?.username ?? null;

      const timestamp = Date.now();

      // Upload WAV
      const wavPath = `${timestamp}-${wavFile.name}`;
      const { error: audioError } = await supabase.storage
        .from("audio")
        .upload(wavPath, wavFile);

      if (audioError) {
        throw new Error("Не удалось загрузить WAV файл. Попробуйте ещё раз.");
      }

      setUploadProgress(35);

      const { data: audioPublic } = supabase.storage.from("audio").getPublicUrl(wavPath);

      if (!audioPublic?.publicUrl) {
        throw new Error("Не удалось получить ссылку на WAV файл.");
      }

      setUploadProgress(50);

      // Upload artwork
      const artworkPath = `${timestamp}-${artworkFile.name}`;
      const { error: artworkError } = await supabase.storage
        .from("artwork")
        .upload(artworkPath, artworkFile);

      if (artworkError) {
        throw new Error("Не удалось загрузить обложку. Попробуйте ещё раз.");
      }

      setUploadProgress(80);

      const { data: artworkPublic } = supabase.storage
        .from("artwork")
        .getPublicUrl(artworkPath);

      if (!artworkPublic?.publicUrl) {
        throw new Error("Не удалось получить ссылку на обложку.");
      }

      setUploadProgress(90);

      setSubmitPhase("saving");

      const { error: insertError } = await supabase.from("releases").insert([
        {
          artist_name: data.artistName,
          author_full_name: data.authorFullName,
          track_name: data.trackName,
          genre: data.genre,
          release_date: data.releaseDate,
          mood: data.mood,
          language: data.language,
          lyrics: data.lyrics,
          explicit: data.explicit,
          music_author: data.musicAuthor,
          license_type: data.licenseType,
          p_line: data.pLine,
          c_line: data.cLine,
          audio_url: audioPublic.publicUrl,
          artwork_url: artworkPublic.publicUrl,
          telegram_id: telegramId,
          telegram_username: telegramUsername
        }
      ]);

      if (insertError) {
        throw new Error("Не удалось сохранить релиз в базе данных.");
      }

      // Fire-and-forget admin notification; не блокируем UX
      try {
        void fetch("/api/notify-admin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            artistName: data.artistName,
            trackName: data.trackName,
            authorFullName: data.authorFullName,
            musicAuthor: data.musicAuthor,
            licenseType: data.licenseType,
            pLine: data.pLine,
            cLine: data.cLine
          })
        });
      } catch {
        // игнорируем ошибки нотификации
      }

      setUploadProgress(100);

      setSubmitPhase("done");
      try {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
      } catch {}
      toast.success("Релиз отправлен на проверку");
      onSubmitted({ artistName: data.artistName, trackName: data.trackName });
    } catch (error: any) {
      setSubmitPhase("idle");
      setSubmitting(false);
      setSubmitError(error?.message || "Произошла ошибка при сохранении релиза.");
      setUploadProgress(0);
      try {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
      } catch {}
      toast.error(error?.message || "Ошибка при сохранении");
      return;
    }

    setSubmitting(false);
  };

  const onInvalidSubmit = () => {
    setInvalidShake(true);
    setTimeout(() => setInvalidShake(false), 250);
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
    } catch {}
    toast.error("Заполните обязательные поля");
  };

  return (
    <div className="min-h-screen bg-background px-4 py-5 pb-10 text-text">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-6 font-sans">
        <header className="space-y-1">
          <h1 className="text-[22px] font-semibold tracking-tight leading-tight">
            Оформление поставки
          </h1>
          <p className="text-[13px] text-text-muted leading-relaxed">
            Заполните метаданные для официальной отгрузки на стриминги.
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
            className="form-card rounded-[24px] border border-white/5 bg-surface/80 px-6 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl focus-within:border-[#007AFF]/50 focus-within:ring-2 focus-within:ring-[#007AFF]/30"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
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
                  className="h-[52px] w-full min-h-[52px] rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[16px] text-white placeholder:text-text-muted outline-none focus:border-primary focus:ring-0 box-border"
                />
                {errors.artistName && (
                  <p className="mt-1 text-[11px] text-red-400">
                    {errors.artistName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
                  Правообладатель (ФИО)
                </label>
                <motion.input
                  {...register("authorFullName", {
                    required: "Укажите ФИО автора / исполнителя"
                  })}
                  placeholder="Фамилия Имя Отчество"
                  onFocus={() => setFocusedField("authorFullName")}
                  onBlur={() =>
                    setFocusedField((prev) => (prev === "authorFullName" ? null : prev))
                  }
                  animate={
                    focusedField === "authorFullName"
                      ? {
                          scale: 1.01,
                          boxShadow: "0 0 0 2px rgba(0,122,255,0.2)"
                        }
                      : { scale: 1, boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
                  }
                  transition={{ duration: 0.12 }}
                  className="h-[52px] w-full min-h-[52px] rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[16px] text-white placeholder:text-text-muted outline-none focus:border-primary focus:ring-0 box-border"
                />
                {errors.authorFullName && (
                  <p className="mt-1 text-[11px] text-red-400">
                    {errors.authorFullName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
                  Наименование произведения
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
                  className="h-[52px] w-full min-h-[52px] rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[16px] text-white placeholder:text-text-muted outline-none focus:border-primary focus:ring-0 box-border"
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
            className="form-card rounded-[24px] border border-white/5 bg-surface/80 px-6 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl focus-within:border-[#007AFF]/50 focus-within:ring-2 focus-within:ring-[#007AFF]/30"
          >
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 mb-4">
              <div className="min-w-0 space-y-1.5">
                <label className="mb-1.5 block pl-4 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
                  Жанр
                </label>
                <select
                  {...register("genre", { required: "Выберите жанр" })}
                  className="h-[52px] min-h-[52px] w-full rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[16px] text-white outline-none focus:border-primary appearance-none box-border"
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

              <div className="min-w-0 space-y-1.5">
                <label className="mb-1.5 block pl-4 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
                  Дата релиза
                </label>
                <input
                  type="date"
                  {...register("releaseDate", {
                    required: "Укажите дату релиза"
                  })}
                  className="h-[52px] min-h-[52px] w-full rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[16px] text-white outline-none [color-scheme:dark] focus:border-primary appearance-none box-border"
                />
                {errors.releaseDate && (
                  <p className="text-[11px] text-red-400 mt-1">
                    {errors.releaseDate.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-4 mb-4">
              <div className="min-w-0 space-y-1.5">
                <label className="mb-1.5 block pl-4 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
                  Настроение
                </label>
                <select
                  {...register("mood", { required: "Выберите настроение" })}
                  className="h-[52px] min-h-[52px] w-full rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[16px] text-white outline-none focus:border-primary appearance-none box-border"
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

              <div className="min-w-0 space-y-1.5">
                <label className="mb-1.5 block pl-4 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
                  Язык
                </label>
                <select
                  {...register("language", { required: "Укажите язык" })}
                  className="h-[52px] min-h-[52px] w-full rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[16px] text-white outline-none focus:border-primary appearance-none box-border"
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

            <div className="space-y-2">
              <label className="mb-1.5 block pl-4 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
                Лирика (Lyrics)
              </label>
              <textarea
                {...register("lyrics")}
                placeholder="Вставьте текст трека, если он готов (опционально)"
                maxLength={LYRICS_MAX}
                className="min-h-[120px] w-full resize-none rounded-[16px] border border-white/5 bg-zinc-800/50 p-4 text-[16px] text-white placeholder:text-text-muted outline-none focus:border-primary box-border"
              />
              <div className="flex justify-end">
                <span
                  className={`text-[11px] ${
                    (values.lyrics?.length ?? 0) >= LYRICS_MAX * 0.9
                      ? "text-red-400"
                      : "text-text-muted"
                  }`}
                >
                  {values.lyrics?.length ?? 0} / {LYRICS_MAX}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 py-3 pt-2 flex-nowrap">
              <span className="text-[15px] font-medium whitespace-nowrap flex-shrink min-w-0">
                Ненормативная лексика
              </span>
              <button
                type="button"
                aria-label="Ненормативная лексика"
                onClick={() => setValue("explicit", !values.explicit)}
                className={`inline-flex h-6 w-10 flex-shrink-0 items-center rounded-full px-[2px] transition-colors ${
                  values.explicit ? "bg-[#007AFF]" : "bg-zinc-700"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white transition-transform ${
                    values.explicit ? "translate-x-[16px]" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                <label className="mb-1.5 block pl-4 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
                  Автор музыки
                </label>
                  <input
                    {...register("musicAuthor", {
                      required: "Укажите автора музыки"
                    })}
                    placeholder="Имя битмейкера / продюсера"
                    className="h-[52px] min-h-[52px] w-full rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[16px] text-white placeholder:text-text-muted outline-none focus:border-primary box-border"
                  />
                  {errors.musicAuthor && (
                    <p className="mt-1 text-[11px] text-red-400">
                      {errors.musicAuthor.message}
                    </p>
                  )}
                </div>
                <div className="min-w-0 space-y-1.5">
                  <label className="mb-1.5 block pl-4 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
                    Тип лицензии
                  </label>
                  <select
                    {...register("licenseType", {
                      required: "Выберите тип лицензии"
                    })}
                    className="h-[52px] min-h-[52px] w-full rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[16px] text-white outline-none focus:border-primary appearance-none box-border"
                  >
                    <option value="">Выберите тип</option>
                    <option value="Собственное производство">Собственное производство</option>
                    <option value="Исключительная лицензия (Exclusive)">
                      Исключительная лицензия (Exclusive)
                    </option>
                    <option value="Неисключительная (Leasing)">Неисключительная (Leasing)</option>
                  </select>
                  {errors.licenseType && (
                    <p className="mt-1 text-[11px] text-red-400">
                      {errors.licenseType.message}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-text-muted pl-1">
                Укажите ФИО человека, создавшего аранжировку.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="form-card rounded-[24px] border border-white/5 bg-surface/80 px-6 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl focus-within:border-[#007AFF]/50 focus-within:ring-2 focus-within:ring-[#007AFF]/30"
          >
            <p className="mb-2 pl-4 text-[11px] font-medium uppercase tracking-[0.2em] text-text-muted">
              ℗ Фонограмма / © Авторское право
            </p>
            <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <input
                  {...register("pLine", {
                    required: "Укажите ℗ (фонограмму)"
                  })}
                  placeholder="2026 OMF Label"
                  className="h-[52px] min-h-[52px] w-full rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[16px] text-white placeholder:text-text-muted outline-none focus:border-primary box-border"
                />
                {errors.pLine && (
                  <p className="mt-1 text-[11px] text-red-400">
                    {errors.pLine.message}
                  </p>
                )}
              </div>
              <div className="min-w-0 space-y-1.5">
                <input
                  {...register("cLine", {
                    required: "Укажите © (авторское право)"
                  })}
                  placeholder="2026 Имя артиста"
                  className="h-[52px] min-h-[52px] w-full rounded-[16px] border border-transparent bg-[#1d1d20] px-4 text-[16px] text-white placeholder:text-text-muted outline-none focus:border-primary box-border"
                />
                {errors.cLine && (
                  <p className="mt-1 text-[11px] text-red-400">
                    {errors.cLine.message}
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="form-card rounded-[24px] border border-white/5 bg-surface/80 px-6 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl space-y-4 focus-within:border-[#007AFF]/50 focus-within:ring-2 focus-within:ring-[#007AFF]/30"
          >
            <FileUploader
              label="Трек (WAV)"
              accept=".wav"
              maxSizeMb={200}
              type="wav"
              onFileChange={setWavFile}
            />
            <FileUploader
              label="Обложка релиза"
              accept=".jpg,.jpeg,.png"
              maxSizeMb={20}
              type="cover"
              onFileChange={setArtworkFile}
            />
          </motion.div>

          {submitPhase !== "idle" && (
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-[20px] bg-[#1d1d20]">
              <motion.div
                className="h-full bg-[#007AFF]"
                initial={{ width: "0%" }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          )}

          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={submitting || !wavFile || !artworkFile}
            className="btn-primary mt-2 inline-flex h-[60px] w-full items-center justify-center rounded-[20px] bg-gradient-to-tr from-[#007AFF] to-[#0051FF] text-[17px] font-semibold text-white shadow-[0_10px_30px_rgba(0,122,255,0.45)] transition-all disabled:opacity-70"
          >
            {submitPhase === "uploading" && "Загружаем файлы..."}
            {submitPhase === "saving" && "Сохраняем релиз..."}
            {submitPhase === "done" && "Готово!"}
            {submitPhase === "idle" && !submitting && "Сформировать релиз"}
          </motion.button>

          {submitError && (
            <p className="mt-2 text-center text-[13px] text-red-400">
              {submitError}
            </p>
          )}

          <p className="mt-8 text-center text-[10px] uppercase tracking-widest text-white/20">
            © 2026 OMF DISTRIBUTION. ВСЕ ПРАВА ЗАЩИЩЕНЫ.
          </p>
        </form>
      </div>
    </div>
  );
}

