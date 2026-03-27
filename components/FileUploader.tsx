"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { Music2, Image as ImageIcon } from "lucide-react";
import confetti from "canvas-confetti";
import { FormFieldError } from "@/components/FormFieldError";
import { ALLOWED_AUDIO_MIME } from "@/repositories/releases.repo";
import { triggerHaptic } from "@/lib/telegram";

type Props = {
  label: string;
  accept: string;
  maxSizeMb: number;
  type: "wav" | "cover";
  onFileChange: (file: File | null) => void;
  /** Pass a File already held in the Zustand store to restore the UI after navigation. */
  initialFile?: File | null;
  /** Persisted remote URL shown as preview when initialFile is unavailable (e.g. after F5). */
  initialPreviewUrl?: string | null;
  /** Подсветка ошибки валидации с родителя (glass + красная обводка). */
  invalid?: boolean;
  /** Реальный прогресс загрузки (0–100), например WAV на сервер; только для type `wav`. */
  uploadProgressPercent?: number | null;
};

function revokeIfBlobUrl(url: string | null): void {
  if (!url) return;
  if (url.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}

export function FileUploader({
  label,
  accept,
  maxSizeMb,
  type,
  onFileChange,
  initialFile,
  initialPreviewUrl,
  invalid = false,
  uploadProgressPercent = null
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const successFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Blob URL created by this component for `initialFile` (cover); revoked on replace/unmount. */
  const ownedBlobUrlRef = useRef<string | null>(null);

  const revokeOwnedBlob = () => {
    if (ownedBlobUrlRef.current) {
      URL.revokeObjectURL(ownedBlobUrlRef.current);
      ownedBlobUrlRef.current = null;
    }
  };

  // Sync from props when Zustand rehydrates after mount or parent updates initialFile / artwork URL.
  useEffect(() => {
    revokeOwnedBlob();
    setError(null);

    if (initialFile) {
      setFile(initialFile);
      if (type === "cover") {
        const url = URL.createObjectURL(initialFile);
        ownedBlobUrlRef.current = url;
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
      return;
    }

    setFile(null);
    if (type === "cover" && initialPreviewUrl?.trim()) {
      setPreviewUrl(initialPreviewUrl.trim());
    } else {
      setPreviewUrl(null);
    }
  }, [initialFile, initialPreviewUrl, type]);

  useEffect(() => {
    return () => {
      revokeOwnedBlob();
    };
  }, []);

  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const magneticX = useSpring(cursorX, { stiffness: 300, damping: 30 });
  const magneticY = useSpring(cursorY, { stiffness: 300, damping: 30 });

  const handleMouseMove = (event: React.MouseEvent<HTMLLabelElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.sqrt(x * x + y * y);
    const radius = 14;

    if (distance < radius) {
      cursorX.set(x * 0.25);
      cursorY.set(y * 0.25);
    } else {
      cursorX.set(0);
      cursorY.set(0);
    }
  };

  const handleMouseLeave = () => {
    cursorX.set(0);
    cursorY.set(0);
  };

  useEffect(() => {
    return () => {
      if (successFlashTimerRef.current != null) {
        clearTimeout(successFlashTimerRef.current);
        successFlashTimerRef.current = null;
      }
    };
  }, []);

  const scheduleSuccessFlash = () => {
    if (successFlashTimerRef.current != null) {
      clearTimeout(successFlashTimerRef.current);
    }
    setIsUploading(true);
    setUploadSuccess(true);
    triggerHaptic("success");
    successFlashTimerRef.current = setTimeout(() => {
      successFlashTimerRef.current = null;
      setIsUploading(false);
      setUploadSuccess(false);
    }, 1200);
  };

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setError(null);

    if (!selected) {
      setFile(null);
      setIsUploading(false);
      onFileChange(null);
      return;
    }

    const sizeMb = selected.size / (1024 * 1024);
    if (sizeMb > maxSizeMb) {
      setError(`Максимальный размер файла ${maxSizeMb}MB`);
      setFile(null);
      onFileChange(null);
      if (previewUrl) {
        revokeIfBlobUrl(previewUrl);
        setPreviewUrl(null);
      }
      setIsUploading(false);
      return;
    }

    if (type === "wav") {
      if (!selected.name.toLowerCase().endsWith(".wav")) {
        setError("Допустим только формат .wav");
        setFile(null);
        onFileChange(null);
        if (previewUrl) {
          revokeIfBlobUrl(previewUrl);
          setPreviewUrl(null);
        }
        setIsUploading(false);
        return;
      }
      const mime = selected.type.trim();
      const mimeOk =
        mime === "" ||
        ALLOWED_AUDIO_MIME.has(mime) ||
        mime === "application/octet-stream" ||
        (mime.startsWith("audio/") && selected.name.toLowerCase().endsWith(".wav"));
      if (!mimeOk) {
        setError(`Неподдерживаемый тип файла (${mime || "пусто"}). Нужен WAV.`);
        setFile(null);
        onFileChange(null);
        if (previewUrl) {
          revokeIfBlobUrl(previewUrl);
          setPreviewUrl(null);
        }
        setIsUploading(false);
        return;
      }
    }

    if (type === "cover") {
      const isJpgOrPng =
        selected.type === "image/jpeg" ||
        selected.type === "image/jpg" ||
        selected.type === "image/png";
      if (!isJpgOrPng) {
        setError("Допустимы только JPG или PNG");
        setFile(null);
        onFileChange(null);
        if (previewUrl) {
          revokeIfBlobUrl(previewUrl);
          setPreviewUrl(null);
        }
        setIsUploading(false);
        return;
      }

      const objectUrl = URL.createObjectURL(selected);
      const img = new Image();
      img.onload = () => {
        if (img.width < 3000 || img.height < 3000) {
          setError("Минимальное разрешение обложки 3000x3000");
          URL.revokeObjectURL(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
          // Parent updates `initialFile` → sync effect sets file + owned blob preview.
          onFileChange(selected);
          scheduleSuccessFlash();
          confetti({ particleCount: 30, spread: 50, origin: { y: 0.4 } });
        }
      };
      img.onerror = () => {
        setError("Не удалось прочитать изображение");
        URL.revokeObjectURL(objectUrl);
        setIsUploading(false);
      };
      img.src = objectUrl;
      return;
    }

    setFile(selected);
    onFileChange(selected);
    // WAV: реальная загрузка в Supabase Storage запускается с родителя — без «фейкового» прогресса.
    if (type !== "wav") {
      scheduleSuccessFlash();
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.4 } });
    }
  };

  const showSelectedState = Boolean(file) || (type === "cover" && Boolean(previewUrl));

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </label>
      <motion.label
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.96 }}
        animate={{
          boxShadow: uploadSuccess
            ? "0 0 0 3px rgba(34,197,94,0.45)"
            : "0 14px 40px rgba(0,0,0,0.65)"
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 30
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          x: magneticX,
          y: magneticY
        }}
        className={`relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[1.25rem] border-2 border-dashed px-4 py-5 text-center text-xs text-muted-foreground transition-[border-color,background-color,box-shadow] duration-200 focus-within:ring-1 focus-within:ring-[#818cf8]/40 focus-within:ring-offset-0 ${
          invalid || error
            ? "border-red-500/55 bg-red-950/20 ring-2 ring-red-500/25 hover:border-red-400/60"
            : "border-white/[0.08] bg-white/[0.03] ring-2 ring-transparent hover:border-[#818cf8]/35 hover:bg-white/[0.05]"
        }`}
      >
        {type === "cover" && !previewUrl && (
          <div
            className="pointer-events-none absolute inset-4 overflow-hidden rounded-xl border border-dashed border-white/[0.06]"
            aria-hidden
          >
            <div
              className="scanner-line absolute left-0 right-0 h-[2px]"
              style={{
                background: "linear-gradient(90deg, transparent, #818cf8, #c084fc, transparent)",
                boxShadow: "0 0 24px rgba(129,140,248,0.4)"
              }}
            />
          </div>
        )}
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />
        {type === "wav" &&
          uploadProgressPercent != null &&
          Number.isFinite(uploadProgressPercent) && (
            <div
              className="absolute inset-0 z-10 flex flex-col justify-end bg-black/45"
              aria-live="polite"
              aria-label={`Загрузка ${Math.round(Math.min(100, Math.max(0, uploadProgressPercent)))}%`}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-semibold tabular-nums text-white drop-shadow-md">
                  {Math.round(Math.min(100, Math.max(0, uploadProgressPercent)))}%
                </span>
              </div>
              <div className="h-2.5 w-full bg-black/40">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-blue-600 transition-[width] duration-150 ease-out"
                  style={{
                    width: `${Math.min(100, Math.max(0, uploadProgressPercent))}%`
                  }}
                />
              </div>
            </div>
          )}
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            {type === "wav" ? (
              <Music2 className="h-4 w-4 text-primary" />
            ) : (
              <ImageIcon className="h-4 w-4 text-primary" />
            )}
            {type === "wav" ? "WAV файл" : "Обложка релиза"}
          </span>
          {type === "wav" ? (
            <span className="text-[11px] leading-snug text-muted-foreground">
              Нажмите, чтобы выбрать WAV (до {maxSizeMb}
              MB)
            </span>
          ) : (
            <span className="text-center text-[11px] leading-snug text-muted-foreground">
              Квадратная, минимум 3000×3000 px,
              <br />
              без лишних надписей и логотипов
            </span>
          )}
          {showSelectedState && (
            <div className="mt-1 w-full max-w-full space-y-1 text-[11px] text-foreground">
              {file ? (
                <div className="flex max-w-full items-center justify-center gap-1 text-emerald-400">
                  <span className="shrink-0 text-base leading-none">✓</span>
                  <span className="min-w-0 truncate text-left" title={file.name}>
                    {file.name}
                  </span>
                </div>
              ) : type === "cover" && previewUrl ? (
                <p className="text-center text-[10px] text-white/50">Обложка из черновика</p>
              ) : null}
              <p className="text-[10px] text-white/45">
                {type === "wav"
                  ? uploadProgressPercent != null
                    ? "Загрузка в Supabase Storage…"
                    : file
                      ? "Файл принят. При необходимости нажмите «Далее» для перехода."
                      : "Выберите WAV — сразу начнётся прямая загрузка в хранилище."
                  : file
                    ? "Локальная проверка файла завершена. Фактическая загрузка начнется на шаге отправки релиза."
                    : "Обложка сохранена в черновике. Можно заменить файлом выше."}
              </p>
              {type !== "wav" && isUploading && (
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/30">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{
                      duration: 1.1,
                      ease: "easeOut"
                    }}
                    className="relative h-full rounded-full bg-gradient-to-r from-emerald-400 via-white to-emerald-400"
                  >
                    <motion.span
                      aria-hidden
                      className="absolute -right-1 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white"
                      style={{
                        boxShadow: "0 0 14px rgba(52,211,153,0.9)"
                      }}
                      animate={{
                        opacity: [0.7, 1, 0.7]
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.8,
                        ease: "easeInOut"
                      }}
                    />
                  </motion.div>
                </div>
              )}
              {previewUrl && type === "cover" && (
                <motion.img
                  key={previewUrl}
                  src={previewUrl}
                  alt="Предпросмотр обложки"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="mx-auto mt-2 h-16 w-16 rounded-lg object-cover"
                />
              )}
            </div>
          )}
        </div>
      </motion.label>

      <FormFieldError message={error ?? undefined} />
    </div>
  );
}
