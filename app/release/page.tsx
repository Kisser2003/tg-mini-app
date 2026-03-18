"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { GripVertical, ImagePlus, Music2, Plus, Trash2, UploadCloud, UserPlus } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { genres, releases } from "@/lib/mock-data";
import {
  RELEASE_DRAFT_STORAGE_KEY,
  appendModerationQueue
} from "@/lib/release-storage";
import type {
  ModerationQueueItem,
  ReleaseDraft,
  ReleaseTrack,
  ReleaseType,
  TrackVersion
} from "@/types/release";

const trackVersions: TrackVersion[] = ["Оригинал", "Ремикс", "Инструментал", "Радио-версия"];

function createTrack(index: number): ReleaseTrack {
  return {
    id: `track-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: index === 0 ? "Главный трек" : `Трек ${index + 1}`,
    audio_file: null,
    version: "Оригинал",
    explicit: false,
    isrc: "",
    contributing_artists: [],
    uploadStatus: "idle",
    uploadProgress: 0
  };
}

function createInitialDraft(): ReleaseDraft {
  return {
    releaseType: "SINGLE",
    releaseTitle: "",
    primaryArtist: "",
    featuringArtists: [],
    genre: genres[0],
    releaseDate: "",
    artwork: null,
    tracks: [createTrack(0)]
  };
}

function normalizeTracksForType(type: ReleaseType, tracks: ReleaseTrack[]) {
  if (type === "SINGLE") {
    return [tracks[0] ?? createTrack(0)];
  }
  if (type === "EP") {
    const normalized = [...tracks];
    while (normalized.length < 2) normalized.push(createTrack(normalized.length));
    return normalized.slice(0, 6);
  }
  const normalized = [...tracks];
  while (normalized.length < 7) normalized.push(createTrack(normalized.length));
  return normalized;
}

export default function ReleasePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<ReleaseDraft>(createInitialDraft);
  const [featureInput, setFeatureInput] = useState("");
  const [showFeatureInput, setShowFeatureInput] = useState(false);
  const [guestInputs, setGuestInputs] = useState<Record<string, string>>({});
  const [expandedGuestInput, setExpandedGuestInput] = useState<Record<string, boolean>>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSavedBadgeVisible, setIsSavedBadgeVisible] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const saveBadgeTimer = useRef<number | null>(null);

  const isSingle = draft.releaseType === "SINGLE";

  const artistsPreview = useMemo(() => {
    const featured = draft.featuringArtists.filter(Boolean);
    if (!featured.length) return draft.primaryArtist || "—";
    return {
      feat: `${draft.primaryArtist || "Артист"} feat. ${featured.join(", ")}`,
      comma: [draft.primaryArtist, ...featured].filter(Boolean).join(", ")
    };
  }, [draft.featuringArtists, draft.primaryArtist]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RELEASE_DRAFT_STORAGE_KEY);
      if (!raw) {
        setIsHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as ReleaseDraft;
      const fallbackDraft = createInitialDraft();
      setDraft({
        ...fallbackDraft,
        ...parsed,
        tracks:
          parsed?.tracks?.map((track, index) => ({
            ...createTrack(index),
            ...track,
            id: track.id || createTrack(index).id
          })) ?? fallbackDraft.tracks
      });
    } catch {
      // ignore malformed localStorage payload
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated || isSubmitted) return;
    window.localStorage.setItem(RELEASE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    setIsSavedBadgeVisible(true);
    if (saveBadgeTimer.current) window.clearTimeout(saveBadgeTimer.current);
    saveBadgeTimer.current = window.setTimeout(() => setIsSavedBadgeVisible(false), 1300);
  }, [draft, isHydrated, isSubmitted]);

  useEffect(() => {
    if (!isSubmitted) return;
    const end = Date.now() + 2200;
    const colors = ["#22d3ee", "#a78bfa", "#f472b6", "#34d399"];
    const timer = window.setInterval(() => {
      if (Date.now() > end) {
        window.clearInterval(timer);
        return;
      }
      confetti({
        particleCount: 45,
        startVelocity: 35,
        spread: 70,
        ticks: 160,
        origin: { y: 0.7 },
        colors
      });
    }, 220);
    return () => window.clearInterval(timer);
  }, [isSubmitted]);

  useEffect(() => {
    return () => {
      if (saveBadgeTimer.current) window.clearTimeout(saveBadgeTimer.current);
    };
  }, []);

  const resetDraft = () => {
    setDraft(createInitialDraft());
    setFeatureInput("");
    setShowFeatureInput(false);
    setGuestInputs({});
    setExpandedGuestInput({});
    setStep(1);
    window.localStorage.removeItem(RELEASE_DRAFT_STORAGE_KEY);
    setIsSavedBadgeVisible(false);
  };

  const updateReleaseType = (type: ReleaseType) => {
    setDraft((prev) => ({
      ...prev,
      releaseType: type,
      tracks: normalizeTracksForType(type, prev.tracks)
    }));
  };

  const addFeatureArtist = () => {
    const trimmed = featureInput.trim();
    if (!trimmed) return;
    setDraft((prev) => ({
      ...prev,
      featuringArtists: [...prev.featuringArtists, trimmed]
    }));
    setFeatureInput("");
    setShowFeatureInput(false);
  };

  const removeFeatureArtist = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      featuringArtists: prev.featuringArtists.filter((_, i) => i !== index)
    }));
  };

  const addTrack = () => {
    setDraft((prev) => {
      if (prev.releaseType === "EP" && prev.tracks.length >= 6) return prev;
      return { ...prev, tracks: [...prev.tracks, createTrack(prev.tracks.length)] };
    });
  };

  const removeTrack = (trackId: string) => {
    setDraft((prev) => {
      const minTracks = prev.releaseType === "ALBUM" ? 7 : prev.releaseType === "EP" ? 2 : 1;
      if (prev.tracks.length <= minTracks) return prev;
      return {
        ...prev,
        tracks: prev.tracks.filter((track) => track.id !== trackId)
      };
    });
  };

  const updateTrack = (trackId: string, patch: Partial<ReleaseTrack>) => {
    setDraft((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) => (track.id === trackId ? { ...track, ...patch } : track))
    }));
  };

  const simulateUpload = (trackId: string, fileName: string) => {
    updateTrack(trackId, {
      audio_file: `mock://${fileName}`,
      uploadStatus: "uploading",
      uploadProgress: 0
    });
    let progress = 0;
    const timer = window.setInterval(() => {
      progress += Math.floor(Math.random() * 18) + 8;
      if (progress >= 100) {
        window.clearInterval(timer);
        updateTrack(trackId, { uploadStatus: "done", uploadProgress: 100 });
        return;
      }
      updateTrack(trackId, { uploadProgress: progress });
    }, 140);
  };

  const addGuestArtist = (trackId: string) => {
    const guest = (guestInputs[trackId] || "").trim();
    if (!guest) return;
    const track = draft.tracks.find((item) => item.id === trackId);
    if (!track) return;
    updateTrack(trackId, { contributing_artists: [...track.contributing_artists, guest] });
    setGuestInputs((prev) => ({ ...prev, [trackId]: "" }));
    setExpandedGuestInput((prev) => ({ ...prev, [trackId]: false }));
  };

  const submitRelease = () => {
    const payload: ModerationQueueItem = {
      id: `m-${Date.now()}`,
      title: draft.releaseTitle || "Без названия",
      artist: draft.primaryArtist || "Неизвестный артист",
      submittedAt: new Date().toLocaleString("ru-RU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      }),
      genre: draft.genre,
      coverUrl: releases[0]?.coverUrl ?? "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=600&q=80"
    };

    appendModerationQueue(payload);
    window.localStorage.removeItem(RELEASE_DRAFT_STORAGE_KEY);
    setIsSubmitted(true);
  };

  const canProceedStep1 = useMemo(
    () => Boolean(draft.releaseTitle.trim() && draft.primaryArtist.trim() && draft.genre),
    [draft.genre, draft.primaryArtist, draft.releaseTitle]
  );

  const canProceedStep2 = useMemo(() => {
    if (isSingle) {
      const track = draft.tracks[0];
      return Boolean(track?.title.trim() && track?.audio_file);
    }
    return draft.tracks.every((track) => track.title.trim() && track.audio_file);
  }, [draft.tracks, isSingle]);

  const canContinue = step === 1 ? canProceedStep1 : step === 2 ? canProceedStep2 : true;
  const next = () => {
    if (!canContinue) return;
    setStep((current) => Math.min(current + 1, 3));
  };
  const prev = () => setStep((current) => Math.max(current - 1, 1));

  if (isSubmitted) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center pb-10">
        <GlassCard className="w-full max-w-[420px] p-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Релиз отправлен!</h2>
          <p className="mt-3 text-sm text-white/70">
            Мы проверим его в течение 24 часов
          </p>
          <motion.button
            type="button"
            whileHover={{ scale: 0.99 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            onClick={() => router.push("/")}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-sky-400 to-violet-500 px-4 py-3 text-sm font-semibold text-white"
          >
            Вернуться на главную
          </motion.button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-10">
      <GlassCard className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/55">Новый релиз</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Focused Flow</h1>
          </div>
          <AnimatePresence>
            {isSavedBadgeVisible && (
              <motion.span
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-full border border-emerald-300/35 bg-emerald-500/20 px-2.5 py-1 text-[11px] text-emerald-100"
              >
                Черновик сохранен
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="mt-4 h-1 rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-500"
            initial={false}
            animate={{ width: `${(step / 3) * 100}%` }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
          />
        </div>
      </GlassCard>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          {step === 1 && (
            <GlassCard className="space-y-4 p-5">
              <h2 className="text-lg font-medium tracking-tight">1. Метаданные</h2>
              <div className="space-y-2">
                <p className="text-xs text-white/65">Тип релиза</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["SINGLE", "EP", "ALBUM"] as ReleaseType[]).map((type) => (
                    <motion.button
                      key={type}
                      type="button"
                      whileHover={{ scale: 0.99 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 320, damping: 22 }}
                      onClick={() => updateReleaseType(type)}
                      className={`rounded-xl border px-3 py-2 text-xs ${
                        draft.releaseType === type
                          ? "border-cyan-300/55 bg-cyan-500/20 text-cyan-100"
                          : "border-white/15 bg-white/[0.02] text-white/70"
                      }`}
                    >
                      {type}
                    </motion.button>
                  ))}
                </div>
              </div>

              <label className="block space-y-1">
                <span className="text-xs text-white/65">Название релиза</span>
                <input
                  value={draft.releaseTitle}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, releaseTitle: event.target.value }))
                  }
                  placeholder="Введите название релиза"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm placeholder:text-white/35"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-white/65">Основной артист</span>
                <input
                  value={draft.primaryArtist}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, primaryArtist: event.target.value }))
                  }
                  placeholder="Имя артиста"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm placeholder:text-white/35"
                />
              </label>

              <div>
                <p className="mb-2 text-xs text-white/65">Жанр</p>
                <div className="flex flex-wrap gap-2">
                  {genres.map((genre) => (
                    <motion.button
                      key={genre}
                      type="button"
                      whileHover={{ scale: 0.99 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 320, damping: 22 }}
                      onClick={() => setDraft((prev) => ({ ...prev, genre }))}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        draft.genre === genre
                          ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100"
                          : "border-white/15 bg-white/5 text-white/70"
                      }`}
                    >
                      {genre}
                    </motion.button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-white/45">Выберите основной стиль</p>
              </div>

              <label className="block space-y-1">
                <span className="text-xs text-white/65">Дата выхода</span>
                <input
                  type="date"
                  value={draft.releaseDate}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, releaseDate: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm"
                />
              </label>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur-3xl">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs text-white/65">При участии</p>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 0.99 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 320, damping: 22 }}
                    onClick={() => setShowFeatureInput((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/[0.03] px-2 py-1 text-[11px] text-white/80"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Добавить
                  </motion.button>
                </div>
                <AnimatePresence>
                  {showFeatureInput && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="mb-2 flex gap-2"
                    >
                      <input
                        value={featureInput}
                        onChange={(event) => setFeatureInput(event.target.value)}
                        placeholder="Имя приглашенного артиста"
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs placeholder:text-white/35"
                      />
                      <motion.button
                        type="button"
                        whileHover={{ scale: 0.99 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 320, damping: 22 }}
                        onClick={addFeatureArtist}
                        className="rounded-xl border border-cyan-300/35 bg-cyan-500/20 px-3 py-2 text-xs text-cyan-100"
                      >
                        ОК
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mb-2 flex flex-wrap gap-2">
                  {draft.featuringArtists.map((artist, index) => (
                    <motion.button
                      key={`${artist}-${index}`}
                      type="button"
                      whileHover={{ scale: 0.99 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 320, damping: 22 }}
                      onClick={() => removeFeatureArtist(index)}
                      className="rounded-full border border-white/20 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/85"
                    >
                      {artist} ×
                    </motion.button>
                  ))}
                </div>

                <p className="text-[11px] text-white/50">
                  Превью:{" "}
                  {typeof artistsPreview === "string"
                    ? artistsPreview
                    : `${artistsPreview.feat} / ${artistsPreview.comma}`}
                </p>
              </div>
            </GlassCard>
          )}

          {step === 2 && (
            <GlassCard className="space-y-4 p-5">
              <h2 className="text-lg font-medium tracking-tight">2. Аудиозапись</h2>
              <AnimatePresence mode="wait">
                {isSingle ? (
                  <motion.div
                    key="single-upload"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-4"
                  >
                    <label className="block space-y-1">
                      <span className="text-xs text-white/65">Название трека</span>
                      <input
                        value={draft.tracks[0]?.title || ""}
                        onChange={(event) =>
                          updateTrack(draft.tracks[0].id, { title: event.target.value })
                        }
                        placeholder="Название трека"
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm placeholder:text-white/35"
                      />
                    </label>
                    <label className="block rounded-2xl border border-dashed border-white/25 bg-white/[0.02] p-6 text-center backdrop-blur-3xl">
                      <UploadCloud className="mx-auto h-7 w-7 text-white/80" />
                      <p className="mt-2 text-sm text-white/80">Аудиофайл (WAV/MP3)</p>
                      <input
                        type="file"
                        accept=".wav,.mp3,audio/*"
                        className="mt-3 block w-full text-xs text-white/70 file:mr-2 file:rounded-lg file:border-0 file:bg-white/15 file:px-2 file:py-1 file:text-white"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          simulateUpload(draft.tracks[0].id, file.name);
                        }}
                      />
                    </label>
                    <div className="wave-track relative rounded-xl border border-white/10 bg-black/25 p-2">
                      <motion.div
                        initial={false}
                        animate={{ width: `${draft.tracks[0]?.uploadProgress || 0}%` }}
                        transition={{ type: "spring", stiffness: 180, damping: 24 }}
                        className="h-2 rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 shadow-[0_0_20px_rgba(125,211,252,0.8)]"
                      />
                    </div>
                    <p className="text-xs text-white/60">
                      {draft.tracks[0]?.uploadStatus === "done" ? "Файл загружен" : "Ожидание загрузки файла"}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="multi-upload"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-3"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-xs text-white/65">Tracklist Manager</p>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 0.99 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 320, damping: 22 }}
                        onClick={addTrack}
                        className="inline-flex items-center gap-1 rounded-full border border-cyan-300/35 bg-cyan-500/20 px-2.5 py-1 text-[11px] text-cyan-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Трек
                      </motion.button>
                    </div>

                    <Reorder.Group
                      axis="y"
                      values={draft.tracks}
                      onReorder={(tracks) => setDraft((prev) => ({ ...prev, tracks }))}
                      className="space-y-3"
                    >
                      {draft.tracks.map((track, index) => (
                        <Reorder.Item
                          key={track.id}
                          value={track}
                          whileDrag={{ scale: 1.01, boxShadow: "0 18px 40px rgba(0,0,0,0.45)" }}
                          transition={{ type: "spring", stiffness: 320, damping: 28 }}
                          className="list-none"
                        >
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ scale: 0.995 }}
                            whileTap={{ scale: 0.98 }}
                            transition={{ type: "spring", stiffness: 300, damping: 24 }}
                            className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur-3xl"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                value={track.title}
                                onChange={(event) => updateTrack(track.id, { title: event.target.value })}
                                placeholder={`Трек ${index + 1}`}
                                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm placeholder:text-white/35"
                              />
                              <div className="flex gap-1">
                                <span className="rounded-lg border border-white/15 bg-white/[0.03] p-1.5 text-white/80">
                                  <GripVertical className="h-3.5 w-3.5" />
                                </span>
                                <motion.button
                                  type="button"
                                  whileHover={{ scale: 0.99 }}
                                  whileTap={{ scale: 0.98 }}
                                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                                  onClick={() => removeTrack(track.id)}
                                  className="rounded-lg border border-rose-300/35 bg-rose-500/20 p-1.5 text-rose-100"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </motion.button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={track.version}
                                onChange={(event) => updateTrack(track.id, { version: event.target.value as TrackVersion })}
                                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs"
                              >
                                {trackVersions.map((version) => (
                                  <option key={version} value={version} className="bg-black">
                                    Версия трека: {version}
                                  </option>
                                ))}
                              </select>
                              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/80">
                                Нецензурная лексика
                                <input
                                  type="checkbox"
                                  checked={track.explicit}
                                  onChange={(event) => updateTrack(track.id, { explicit: event.target.checked })}
                                  className="h-4 w-4 accent-rose-400"
                                />
                              </label>
                            </div>

                            <input
                              value={track.isrc || ""}
                              onChange={(event) => updateTrack(track.id, { isrc: event.target.value })}
                              placeholder="ISRC (опционально)"
                              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs placeholder:text-white/35"
                            />
                            <p className="text-[11px] text-white/45">Оставьте пустым, если у вас его нет</p>

                            <label className="block rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-3 text-center backdrop-blur-3xl">
                              <p className="mb-2 text-xs text-white/75">Аудиофайл</p>
                              <input
                                type="file"
                                accept=".wav,.mp3,audio/*"
                                className="block w-full text-xs text-white/70 file:mr-2 file:rounded-lg file:border-0 file:bg-white/15 file:px-2 file:py-1 file:text-white"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (!file) return;
                                  simulateUpload(track.id, file.name);
                                }}
                              />
                            </label>

                            <div className="wave-track relative rounded-xl border border-white/10 bg-black/25 p-2">
                              <motion.div
                                initial={false}
                                animate={{ width: `${track.uploadProgress}%` }}
                                transition={{ type: "spring", stiffness: 180, damping: 24 }}
                                className="h-2 rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 shadow-[0_0_20px_rgba(125,211,252,0.8)]"
                              />
                            </div>

                            <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                              <div className="mb-2 flex items-center justify-between">
                                <p className="text-xs text-white/65">Гости трека</p>
                                <motion.button
                                  type="button"
                                  whileHover={{ scale: 0.99 }}
                                  whileTap={{ scale: 0.98 }}
                                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                                  onClick={() =>
                                    setExpandedGuestInput((prev) => ({ ...prev, [track.id]: !prev[track.id] }))
                                  }
                                  className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/[0.03] px-2 py-1 text-[11px] text-white/80"
                                >
                                  <UserPlus className="h-3.5 w-3.5" />
                                  Добавить гостя
                                </motion.button>
                              </div>
                              <AnimatePresence>
                                {expandedGuestInput[track.id] && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="mb-2 flex gap-2"
                                  >
                                    <input
                                      value={guestInputs[track.id] || ""}
                                      onChange={(event) =>
                                        setGuestInputs((prev) => ({ ...prev, [track.id]: event.target.value }))
                                      }
                                      placeholder="Имя гостевого артиста"
                                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs placeholder:text-white/35"
                                    />
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 0.99 }}
                                      whileTap={{ scale: 0.98 }}
                                      transition={{ type: "spring", stiffness: 320, damping: 22 }}
                                      onClick={() => addGuestArtist(track.id)}
                                      className="rounded-xl border border-cyan-300/35 bg-cyan-500/20 px-3 py-2 text-xs text-cyan-100"
                                    >
                                      ОК
                                    </motion.button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                              <div className="flex flex-wrap gap-1.5">
                                {track.contributing_artists.map((artist, artistIndex) => (
                                  <span
                                    key={`${artist}-${artistIndex}`}
                                    className="rounded-full border border-white/20 bg-white/[0.03] px-2 py-1 text-[11px] text-white/80"
                                  >
                                    {artist}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Music2 className="h-4 w-4" />
                Логика адаптируется под тип релиза: SINGLE / EP / ALBUM.
              </div>
            </GlassCard>
          )}

          {step === 3 && (
            <GlassCard className="space-y-4 p-5">
              <h2 className="text-lg font-medium tracking-tight">3. Обложка</h2>
              <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-4">
                <div className="mx-auto aspect-square w-full max-w-[240px] rounded-2xl border border-white/15 bg-black/30 p-4">
                  <div className="flex h-full items-center justify-center rounded-xl border border-white/10">
                    <div className="text-center">
                      <ImagePlus className="mx-auto h-8 w-8 text-white/80" />
                      <p className="mt-2 text-sm text-white/75">Обложка (1:1)</p>
                    </div>
                  </div>
                </div>
              </div>
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setDraft((prev) => ({ ...prev, artwork: file.name }));
                  }}
                  className="block w-full text-xs text-white/70 file:mr-2 file:rounded-lg file:border-0 file:bg-white/15 file:px-2 file:py-1 file:text-white"
                />
              </label>

              <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur-3xl">
                <p className="text-xs text-white/60">Предпросмотр (Apple Music)</p>
                <div className="glass-card flex items-center gap-3 rounded-2xl p-3">
                  <div className="h-16 w-16 overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br from-sky-500/30 via-violet-500/30 to-fuchsia-500/30">
                    <div className="flex h-full items-center justify-center text-[10px] text-white/65">
                      {draft.artwork ? "Обложка" : "1:1"}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium tracking-tight">
                      {draft.releaseTitle || "Название релиза"}
                    </p>
                    <p className="truncate text-xs text-white/60">
                      {draft.primaryArtist || "Основной артист"}
                    </p>
                    <p className="text-[11px] text-white/45">{draft.releaseType}</p>
                  </div>
                </div>
              </div>

              <motion.button
                type="button"
                whileHover={{ scale: 0.99 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                onClick={submitRelease}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(16,185,129,0.35)]"
              >
                Отправить на модерацию
              </motion.button>
            </GlassCard>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="grid grid-cols-3 gap-3">
        <motion.button
          type="button"
          whileHover={{ scale: 0.99 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          onClick={prev}
          className="rounded-2xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white/80 disabled:opacity-40"
          disabled={step === 1}
        >
          Назад
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 0.99 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          onClick={next}
          className="rounded-2xl bg-white/90 px-3 py-3 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
          disabled={step === 3 || !canContinue}
        >
          Далее
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 0.99 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          onClick={resetDraft}
          className="rounded-2xl border border-rose-300/35 bg-rose-500/15 px-3 py-3 text-sm text-rose-100"
        >
          Сбросить черновик
        </motion.button>
      </div>

      {step < 3 && !canContinue && (
        <p className="text-center text-xs text-amber-200/90">
          Для продолжения заполните обязательные поля: заголовок, жанр и аудиофайл.
        </p>
      )}
    </div>
  );
}
