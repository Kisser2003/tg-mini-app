"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { AlertCircle, Pause, Play } from "lucide-react";
import { toast } from "sonner";

type Props = {
  src: string;
  label: string;
  className?: string;
  /** Режим модерации: компактный плеер + 1× / 1.5× */
  variant?: "default" | "admin";
};

function useBufferedAndProgress(audioRef: RefObject<HTMLAudioElement | null>, src: string) {
  const [bufferedRatio, setBufferedRatio] = useState(0);
  const [currentRatio, setCurrentRatio] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const update = () => {
      const d = el.duration;
      if (!d || !Number.isFinite(d) || d <= 0) {
        setBufferedRatio(0);
        setCurrentRatio(0);
        return;
      }
      let bufEnd = 0;
      for (let i = 0; i < el.buffered.length; i += 1) {
        bufEnd = Math.max(bufEnd, el.buffered.end(i));
      }
      setBufferedRatio(Math.min(1, bufEnd / d));
      setCurrentRatio(Math.min(1, el.currentTime / d));
    };

    el.addEventListener("progress", update);
    el.addEventListener("timeupdate", update);
    el.addEventListener("loadedmetadata", update);
    el.addEventListener("durationchange", update);
    el.addEventListener("canplay", update);

    update();

    return () => {
      el.removeEventListener("progress", update);
      el.removeEventListener("timeupdate", update);
      el.removeEventListener("loadedmetadata", update);
      el.removeEventListener("durationchange", update);
      el.removeEventListener("canplay", update);
    };
  }, [audioRef, src]);

  return { bufferedRatio, currentRatio };
}

/**
 * Плеер для WAV/аудио из Supabase Storage: стрим через <audio>, ошибки сети/декодера — тост + иконка.
 * preload=auto + буфер в SeekBar для экономии трафика при повторном прослушивании (совместно с SW).
 */
export function AudioPlayer({ src, label, className = "", variant = "default" }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed15, setSpeed15] = useState(false);
  const { bufferedRatio, currentRatio } = useBufferedAndProgress(audioRef, src);
  const isAdmin = variant === "admin";

  const onError = useCallback(() => {
    setLoadError(true);
    setPlaying(false);
    toast.error("Не удалось загрузить аудио. Проверь, что файл есть в хранилище.");
  }, []);

  useEffect(() => {
    setLoadError(false);
    setPlaying(false);
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.src = src;
    el.load();
  }, [src]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = speed15 ? 1.5 : 1;
  }, [speed15, src]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el || loadError) return;
    el.playbackRate = speed15 ? 1.5 : 1;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    void el.play().catch(() => {
      onError();
    });
  }, [loadError, onError, playing, speed15]);

  const toggleSpeed = useCallback(() => {
    setSpeed15((s) => !s);
    const el = audioRef.current;
    if (el) el.playbackRate = !speed15 ? 1.5 : 1;
  }, [speed15]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [src]);

  return (
    <div className={`rounded-control border border-omf-line bg-omf-surface p-2.5 ${className}`}>
      {!isAdmin && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="truncate text-[13px] text-omf-graphite">{label}</p>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={loadError}
          aria-label={loadError ? "Ошибка загрузки аудио" : playing ? "Пауза" : "Воспроизвести"}
          className="omf-focus flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-omf-ink text-omf-bg disabled:opacity-50"
        >
          {loadError ? (
            <AlertCircle className="h-5 w-5 text-omf-red" />
          ) : playing ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 pl-0.5" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <audio
            ref={audioRef}
            controls={false}
            controlsList="nodownload"
            preload="auto"
            crossOrigin="anonymous"
            playsInline
            className="sr-only"
            src={src}
            onError={onError}
          />
          {isAdmin && (
            <p className="mb-1.5 truncate text-[14px] leading-tight text-omf-ink" title={label}>
              {label}
            </p>
          )}
          <div
            className="relative h-1 w-full overflow-hidden rounded-full bg-omf-line"
            role="progressbar"
            aria-label="Позиция в треке"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(currentRatio * 100)}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-omf-line-strong transition-[width] duration-150 ease-out"
              style={{ width: `${bufferedRatio * 100}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-omf-ultra transition-[width] duration-100 ease-linear"
              style={{ width: `${currentRatio * 100}%` }}
            />
          </div>
          {!isAdmin && (
            <p className="mt-1.5 text-[13px] text-omf-graphite">
              {loadError ? "Не удалось загрузить" : "Нажми Play, чтобы послушать"}
            </p>
          )}
          {isAdmin && loadError && (
            <p className="mt-1 text-[13px] text-omf-red">Не удалось загрузить аудио</p>
          )}
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={toggleSpeed}
            disabled={loadError}
            aria-label={speed15 ? "Скорость 1,5×, нажми для обычной" : "Обычная скорость, нажми для 1,5×"}
            className="omf-focus shrink-0 rounded-full px-2.5 py-1.5 text-[13px] text-omf-graphite hover:text-omf-ink disabled:opacity-50"
          >
            {speed15 ? "1,5×" : "1×"}
          </button>
        )}
      </div>
    </div>
  );
}
