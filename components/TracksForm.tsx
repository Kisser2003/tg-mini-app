import { useState, useCallback, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { FileUploader } from "./FileUploader";
import { getTelegramWebApp } from "@/lib/telegram";
import { useTelegramMainButton } from "@/lib/useTelegramMainButton";

const trackSchema = z.object({
  title: z.string().min(1, "Укажите название трека"),
  explicit: z.boolean()
});

const tracksFormSchema = z.object({
  tracks: z.array(trackSchema).min(1, "Добавьте хотя бы один трек")
});

export type TracksFormValues = z.infer<typeof tracksFormSchema>;

type TracksFormProps = {
  onSubmitted: () => void;
  releaseTitle: string;
  artistName: string;
  onSubmitTracks: (tracks: { title: string; explicit: boolean; file: File }[]) => Promise<void>;
  isSubmitting?: boolean;
  submitError?: string | null;
  initialValues?: TracksFormValues;
  onChangeValues?: (values: TracksFormValues) => void;
};

export function TracksForm({
  onSubmitted,
  releaseTitle,
  artistName,
  onSubmitTracks,
  isSubmitting,
  submitError,
  initialValues,
  onChangeValues
}: TracksFormProps) {
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid }
  } = useForm<TracksFormValues>({
    resolver: zodResolver(tracksFormSchema),
    defaultValues: {
      tracks: initialValues?.tracks ?? [{ title: "", explicit: false }]
    },
    mode: "onChange"
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "tracks"
  });

  const [files, setFiles] = useState<(File | null)[]>(initialValues?.tracks?.map(() => null) ?? [null]);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const values = watch();

  // синхронизация значения формы наружу для персиста
  useEffect(() => {
    if (onChangeValues) {
      onChangeValues(values);
    }
  }, [values, onChangeValues]);

  const onValidSubmit = async (data: TracksFormValues) => {
    setSubmitAttempted(true);

    const tracksWithFiles = data.tracks.map((track, index) => ({
      title: track.title,
      explicit: Boolean(track.explicit),
      file: files[index]
    }));

    const missingFile = tracksWithFiles.some((t) => !t.file);
    if (missingFile) {
      try {
        getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.("error");
      } catch {}
      return;
    }

    try {
      await onSubmitTracks(
        tracksWithFiles.map((t) => ({
          title: t.title,
          explicit: t.explicit,
          file: t.file as File
        }))
      );
    } catch {
      // ошибка уже отображается выше по дереву
      return;
    }

    try {
      getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.("success");
    } catch {}

    onSubmitted();
  };

  const onInvalidSubmit = () => {
    setSubmitAttempted(true);
    try {
      getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.("error");
    } catch {}
  };

  const handleMainButtonClick = useCallback(() => {
    void handleSubmit(onValidSubmit, onInvalidSubmit)();
  }, [handleSubmit, onValidSubmit, onInvalidSubmit]);

  useTelegramMainButton({
    text: isSubmitting ? "Сохраняем..." : "Отправить релиз",
    enabled: isValid && !isSubmitting,
    loading: Boolean(isSubmitting),
    onClick: handleMainButtonClick
  });

  return (
    <div className="min-h-screen bg-black px-4 py-5 pb-10 text-white">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-5 font-sans">
        <header className="space-y-1">
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight">
            Треки · {artistName} — {releaseTitle}
          </h1>
          <p className="text-[13px] text-white/60 leading-relaxed">
            Добавьте трек-лист релиза. Для каждого трека — своё название и WAV.
          </p>
        </header>

        <form
          onSubmit={handleSubmit(onValidSubmit, onInvalidSubmit)}
          className="flex flex-col gap-4"
        >
          {fields.map((field, index) => (
            <motion.div
              key={field.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.75)] backdrop-blur-2xl space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Трек {index + 1}
                </span>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      remove(index);
                      setFiles((prev) => prev.filter((_, i) => i !== index));
                    }}
                    className="text-[11px] text-white/40"
                  >
                    Удалить
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
                  Название трека
                </label>
                <input
                  {...register(`tracks.${index}.title` as const)}
                  placeholder="Например, Intro / Track 1"
                  className="h-[48px] w-full rounded-[16px] border border-white/10 bg-black/60 px-4 text-[14px] sm:text-[15px] text-white placeholder:text-white/30 outline-none focus:border-[#4F46E5]"
                />
                {errors.tracks?.[index]?.title && (
                  <p className="mt-0.5 text-[11px] text-red-400">
                    {errors.tracks[index]?.title?.message}
                  </p>
                )}
              </div>

              <FileUploader
                label="WAV трека"
                accept=".wav"
                maxSizeMb={200}
                type="wav"
                onFileChange={(file) => {
                  setFiles((prev) => {
                    const next = [...prev];
                    next[index] = file;
                    return next;
                  });
                }}
              />

              {submitAttempted && !files[index] && (
                <p className="text-[11px] text-red-400">
                  Загрузите WAV-файл для этого трека.
                </p>
              )}
            </motion.div>
          ))}

          {typeof errors.tracks?.message === "string" && (
            <p className="text-[11px] text-red-400">{errors.tracks.message}</p>
          )}

          <button
            type="button"
            onClick={() => {
              append({ title: "", explicit: false });
              setFiles((prev) => [...prev, null]);
            }}
            className="mt-1 inline-flex h-[44px] w-full items-center justify-center rounded-[18px] border border-white/15 text-[13px] font-medium text-white/80 hover:border-white/40 hover:text-white transition-colors"
          >
            + Добавить трек
          </button>

          <motion.button
            type="submit"
            whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
            whileTap={{ scale: isSubmitting ? 1 : 0.96 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 28
            }}
            disabled={isSubmitting}
            className="mt-3 inline-flex h-[60px] w-full items-center justify-center rounded-[20px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[17px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.6)] transition-all disabled:opacity-60 disabled:shadow-none"
          >
            {isSubmitting ? "Сохраняем треки..." : "Отправить релиз"}
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

