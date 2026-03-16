import { useState, useEffect } from "react";
import { motion } from "framer-motion";

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
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-zinc-200">{label}</label>
      <motion.label
        whileHover={{ scale: 1.01 }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-4 text-center text-xs text-zinc-400 hover:border-accent hover:bg-zinc-900/70 transition-colors"
      >
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />
        <span className="mb-1 font-medium text-zinc-100">
          Нажмите, чтобы выбрать файл
        </span>
        <span className="text-[11px] text-zinc-500">
          {type === "wav"
            ? "WAV, до 100MB"
            : "JPG/PNG, минимум 3000x3000"}
        </span>
        {file && (
          <div className="mt-2 text-[11px] text-zinc-300 truncate max-w-full">
            {file.name}
          </div>
        )}
      </motion.label>

      {previewUrl && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-zinc-800">
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

