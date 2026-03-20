"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Pause, Play } from "lucide-react";
import { toast } from "sonner";

type Props = {
  src: string;
  label: string;
  className?: string;
};

/**
 * Плеер для WAV/аудио из Supabase Storage: стрим через <audio>, ошибки сети/декодера — тост + иконка.
 */
export function AudioPlayer({ src, label, className = "" }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [playing, setPlaying] = useState(false);

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

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el || loadError) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    void el.play().catch(() => {
      onError();
    });
  }, [loadError, onError, playing]);

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
      <p className="mb-2 truncate text-[11px] text-white/55">{label}</p>
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
        <audio
          ref={audioRef}
          controls={false}
          controlsList="nodownload"
          preload="metadata"
          className="sr-only"
          src={src}
          onError={onError}
        />
        <p className="min-w-0 flex-1 text-[11px] text-white/40">
          {loadError ? "Ошибка загрузки" : "Нажмите Play для прослушивания"}
        </p>
      </div>
    </div>
  );
}
