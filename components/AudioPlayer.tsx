"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AlertCircle, Gauge, Pause, Play } from "lucide-react";
import { toast } from "sonner";

type Props = {
  src: string;
  label: string;
  className?: string;
  /** Режим модерации: декоративная «волна» + переключение 1× / 1.5× */
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

function seededHeights(seed: string, count: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    h = (h * 1664525 + 1013904223) >>> 0;
    out.push(0.25 + (h % 1000) / 1000);
  }
  return out;
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
  const waveBars = useMemo(() => seededHeights(src, 48), [src]);
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
      className={`rounded-xl border border-white/10 bg-white/[0.04] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl ${className}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-[11px] text-white/55">{label}</p>
        {isAdmin && (
          <button
            type="button"
            onClick={toggleSpeed}
            disabled={loadError}
            title={speed15 ? "Скорость 1.5×" : "Скорость 1×"}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100/90 disabled:opacity-50"
          >
            <Gauge className="h-3 w-3" />
            {speed15 ? "1.5×" : "1×"}
          </button>
        )}
      </div>
      {isAdmin && (
        <div
          className="mb-2 flex h-10 w-full items-end justify-between gap-px rounded-lg border border-white/[0.06] bg-black/30 px-1 py-1"
          aria-hidden
          title="Схематичная «волна» (громкие/тихие участки условно)"
        >
          {waveBars.map((h, i) => {
            const lit = currentRatio > 0 && i / waveBars.length <= currentRatio;
            return (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                className={`min-w-[2px] flex-1 rounded-sm transition-colors duration-150 ${
                  lit ? "bg-gradient-to-t from-violet-500/90 to-cyan-300/80" : "bg-white/15"
                }`}
                style={{ height: `${Math.round(12 + h * 22)}px` }}
              />
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={loadError}
          aria-label={loadError ? "Ошибка загрузки аудио" : playing ? "Пауза" : "Воспроизвести"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-black/40 text-white/90 disabled:opacity-50"
        >
          {loadError ? (
            <AlertCircle className="h-5 w-5 text-rose-400" />
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
          <div
            className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            aria-hidden
            title="Серый — дорожка; светлый — загружено в буфер; акцент — текущая позиция"
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
          <p className="mt-1.5 text-[11px] text-white/40">
            {loadError
              ? "Ошибка загрузки"
              : isAdmin
                ? "Волна — ориентир; полоска — буфер и позиция"
                : "Нажмите Play для прослушивания"}
          </p>
        </div>
      </div>
    </div>
  );
}
