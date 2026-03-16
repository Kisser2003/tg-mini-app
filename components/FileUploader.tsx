import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Music2, Image as ImageIcon } from "lucide-react";
import confetti from "canvas-confetti";

type Props = {
  label: string;
  accept: string;
  maxSizeMb: number;
  type: "wav" | "cover";
  onFileChange: (file: File | null) => void;
};

export function FileUploader({ label, accept, maxSizeMb, type, onFileChange }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setError(null);

    if (!selected) {
      setFile(null);
      onFileChange(null);
      return;
    }

    const sizeMb = selected.size / (1024 * 1024);
    if (sizeMb > maxSizeMb) {
      setError(`Максимальный размер файла ${maxSizeMb}MB`);
      return;
    }

    if (type === "wav" && !selected.name.toLowerCase().endsWith(".wav")) {
      setError("Допустим только формат .wav");
      return;
    }

    if (type === "cover") {
      const isJpgOrPng =
        selected.type === "image/jpeg" ||
        selected.type === "image/jpg" ||
        selected.type === "image/png";
      if (!isJpgOrPng) {
        setError("Допустимы только JPG или PNG");
        return;
      }

      const objectUrl = URL.createObjectURL(selected);
      const img = new Image();
      img.onload = () => {
        if (img.width < 3000 || img.height < 3000) {
          setError("Минимальное разрешение обложки 3000x3000");
          URL.revokeObjectURL(objectUrl);
        } else {
          setPreviewUrl(objectUrl);
          setFile(selected);
          onFileChange(selected);
          setUploadSuccess(true);
          setTimeout(() => setUploadSuccess(false), 1200);
          confetti({ particleCount: 30, spread: 50, origin: { y: 0.4 } });
        }
      };
      img.onerror = () => {
        setError("Не удалось прочитать изображение");
        URL.revokeObjectURL(objectUrl);
      };
      img.src = objectUrl;
      return;
    }

    setFile(selected);
    onFileChange(selected);
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 1200);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.4 } });
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-text-muted uppercase tracking-[0.16em]">
        {label}
      </label>
      <motion.label
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        animate={{
          boxShadow: uploadSuccess
            ? "0 0 0 3px rgba(34,197,94,0.45)"
            : "0 14px 40px rgba(0,0,0,0.65)"
        }}
        transition={{ duration: 0.25 }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface/70 px-4 py-5 text-center text-xs text-text-muted hover:border-primary hover:bg-surface transition-colors"
      >
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />
        <span className="mb-2 flex items-center gap-2 text-sm font-medium text-text">
          {type === "wav" ? (
            <Music2 className="h-4 w-4 text-primary" />
          ) : (
            <ImageIcon className="h-4 w-4 text-primary" />
          )}
          {type === "wav" ? "WAV файл" : "Обложка релиза"}
        </span>
        <span className="text-[11px] text-text-muted">
          {type === "wav"
            ? `Нажмите, чтобы выбрать WAV (до ${maxSizeMb}MB)`
            : "Квадратная, минимум 3000×3000 px, без лишних надписей и логотипов"}
        </span>
        {file && (
          <div className="mt-2 text-[11px] text-text truncate max-w-full">
            ✓ {file.name}
          </div>
        )}
      </motion.label>

      {previewUrl && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-border">
          <img
            src={previewUrl}
            alt="Cover preview"
            className="h-32 w-full object-cover"
          />
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

