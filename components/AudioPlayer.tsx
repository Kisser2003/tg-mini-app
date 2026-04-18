"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { AlertCircle, Gauge, Pause, Play } from "lucide-react";
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
    toast.error("Не удалось загрузить аудио. Проверьте файл в Storage или права доступа.");
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
    <div
      className={`rounded-xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl ${
        isAdmin ? "rounded-lg p-1.5" : "p-2"
      } ${className}`}
    >
      {!isAdmin && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="truncate text-[11px] text-white/55">{label}</p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={loadError}
          aria-label={loadError ? "Ошибка загрузки аудио" : playing ? "Пауза" : "Воспроизвести"}
          className={`flex shrink-0 items-center justify-center rounded-lg border border-white/15 bg-black/40 text-white/90 disabled:opacity-50 ${
            isAdmin ? "h-8 w-8" : "h-10 w-10"
          }`}
        >
          {loadError ? (
            <AlertCircle className={`text-rose-400 ${isAdmin ? "h-4 w-4" : "h-5 w-5"}`} />
          ) : playing ? (
            <Pause className={isAdmin ? "h-4 w-4" : "h-5 w-5"} />
          ) : (
            <Play className={`pl-0.5 ${isAdmin ? "h-4 w-4" : "h-5 w-5"}`} />
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
            <p className="mb-1 truncate text-[10px] leading-tight text-white/50" title={label}>
              {label}
            </p>
          )}
          <div
            className={`relative w-full overflow-hidden rounded-full bg-white/10 ${
              isAdmin ? "h-1" : "h-1.5"
            }`}
            aria-hidden
            title="Светлая зона — буфер; фиолетовый — позиция"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/20 transition-[width] duration-150 ease-out"
              style={{ width: `${bufferedRatio * 100}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-violet-400/85 transition-[width] duration-100 ease-linear"
              style={{ width: `${currentRatio * 100}%` }}
            />
          </div>
          {!isAdmin && (
            <p className="mt-1.5 text-[11px] text-white/40">
              {loadError ? "Ошибка загрузки" : "Нажмите Play для прослушивания"}
            </p>
          )}
          {isAdmin && loadError && (
            <p className="mt-1 text-[10px] text-rose-300/90">Ошибка загрузки</p>
          )}
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={toggleSpeed}
            disabled={loadError}
            title={speed15 ? "Скорость 1.5×" : "Скорость 1×"}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-white/15 bg-white/[0.06] px-1.5 py-1 text-[9px] font-medium text-white/75 hover:bg-white/10 disabled:opacity-50"
          >
            <Gauge className="h-2.5 w-2.5" />
            {speed15 ? "1.5×" : "1×"}
          </button>
        )}
      </div>
    </div>
  );
}
