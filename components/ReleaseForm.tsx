"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabaseClient";
import {
  getTelegramUserId,
  getTelegramWebApp,
  initTelegramWebApp
} from "@/lib/telegram";
import { FileUploader } from "./FileUploader";

type ReleaseFormProps = {
  onSubmitted: () => void;
};

type FormState = {
  artistName: string;
  trackTitle: string;
  featuring: string;
  genre: string;
  releaseDate: string;
  explicit: boolean;
};

export function ReleaseForm({ onSubmitted }: ReleaseFormProps) {
  const [form, setForm] = useState<FormState>({
    artistName: "",
    trackTitle: "",
    featuring: "",
    genre: "",
    releaseDate: "",
    explicit: false
  });
  const [wavFile, setWavFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [telegramUserId, setTelegramUserId] = useState<number | null>(null);

  useEffect(() => {
    initTelegramWebApp();
    setTelegramUserId(getTelegramUserId());
  }, []);

  const handleChange = (
    field: keyof FormState,
    value: string | boolean
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (!form.artistName.trim()) return "Укажите имя артиста";
    if (!form.trackTitle.trim()) return "Укажите название трека";
    if (!form.genre.trim()) return "Укажите жанр";
    if (!form.releaseDate) return "Укажите дату релиза";
    if (!wavFile) return "Загрузите WAV файл";
    if (!coverFile) return "Загрузите обложку";
    return null;
  };

  const uploadFile = async (
    folder: "wav" | "covers",
    file: File
  ): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExt}`;
    const filePath = `releases/${folder}/${fileName}`;

    const { error: uploadError } = await supabaseBrowser.storage
      .from("releases")
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabaseBrowser.storage.from("releases").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!wavFile || !coverFile) return;

    try {
      setSubmitting(true);

      const [wavUrl, coverUrl] = await Promise.all([
        uploadFile("wav", wavFile),
        uploadFile("covers", coverFile)
      ]);

      const response = await fetch("/api/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist_name: form.artistName,
          track_title: form.trackTitle,
          featuring: form.featuring || null,
          genre: form.genre,
          release_date: form.releaseDate,
          explicit: form.explicit,
          wav_url: wavUrl,
          cover_url: coverUrl,
          telegram_user_id: telegramUserId
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Не удалось отправить релиз");
      }

      onSubmitted();
    } catch (err: any) {
      setError(err.message || "Произошла ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const webApp = getTelegramWebApp();
    const mainButton = webApp?.MainButton;
    if (!mainButton) return;

    const submitFromTelegram = () => {
      const formEl = document.getElementById("release-form") as HTMLFormElement | null;
      formEl?.requestSubmit();
    };

    mainButton.setText(submitting ? "Отправка..." : "Отправить релиз");
    if (submitting) {
      mainButton.show().disable().showProgress();
    } else {
      mainButton.show().enable().hideProgress();
    }

    mainButton.onClick(submitFromTelegram);
    return () => {
      mainButton.offClick(submitFromTelegram);
      mainButton.hide().hideProgress();
    };
  }, [submitting]);

  return (
    <motion.form
      id="release-form"
      onSubmit={handleSubmit}
      className="space-y-4"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-300">
          Artist Name
        </label>
        <input
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition"
          value={form.artistName}
          onChange={(e) => handleChange("artistName", e.target.value)}
          placeholder="Имя артиста"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-300">
          Track Title
        </label>
        <input
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition"
          value={form.trackTitle}
          onChange={(e) => handleChange("trackTitle", e.target.value)}
          placeholder="Название трека"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-300">
          Featuring (если есть)
        </label>
        <input
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition"
          value={form.featuring}
          onChange={(e) => handleChange("featuring", e.target.value)}
          placeholder="feat. артист"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-300">
          Genre
        </label>
        <input
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition"
          value={form.genre}
          onChange={(e) => handleChange("genre", e.target.value)}
          placeholder="Жанр (например, Techno)"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-300">
          Release Date
        </label>
        <input
          type="date"
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition"
          value={form.releaseDate}
          onChange={(e) => handleChange("releaseDate", e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-zinc-900/60 px-3 py-2">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-zinc-200">
            Explicit
          </span>
          <span className="text-[11px] text-zinc-500">
            Контент с ненормативной лексикой
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleChange("explicit", !form.explicit)}
          className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
            form.explicit ? "bg-emerald-500" : "bg-zinc-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              form.explicit ? "translate-x-4" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <FileUploader
        label="Upload WAV file"
        accept=".wav,audio/wav"
        maxSizeMb={100}
        type="wav"
        onFileChange={setWavFile}
      />

      <FileUploader
        label="Upload Cover Art"
        accept="image/jpeg,image/png"
        maxSizeMb={20}
        type="cover"
        onFileChange={setCoverFile}
      />

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/40 rounded-2xl px-3 py-2">
          {error}
        </p>
      )}

      <motion.button
        type="submit"
        whileTap={{ scale: 0.98 }}
        disabled={submitting}
        className="mt-2 flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-60 disabled:hover:bg-emerald-500"
      >
        {submitting ? (
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />
            Отправляем…
          </span>
        ) : (
          "Submit Release"
        )}
      </motion.button>
    </motion.form>
  );
}

