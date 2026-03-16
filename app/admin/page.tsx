"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { getTelegramUserId } from "@/lib/telegram";

type ReleaseRow = {
  id: number;
  artist_name: string;
  author_full_name: string | null;
  track_name: string;
  genre: string | null;
  mood: string | null;
  lyrics: string | null;
  audio_url: string | null;
  artwork_url: string | null;
  created_at: string;
};

export default function AdminPage() {
  const [releases, setReleases] = useState<ReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLyricsId, setExpandedLyricsId] = useState<number | null>(null);

  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const adminId = process.env.NEXT_PUBLIC_ADMIN_TELEGRAM_ID;
    const currentId = getTelegramUserId();
    if (adminId && currentId && String(currentId) === String(adminId)) {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: dbError } = await supabase
          .from("releases")
          .select(
            "id, artist_name, author_full_name, track_name, genre, mood, lyrics, audio_url, artwork_url, created_at"
          )
          .order("created_at", { ascending: false });

        if (dbError) {
          throw dbError;
        }

        setReleases(data as ReleaseRow[]);
      } catch (err: any) {
        setError(err?.message || "Не удалось загрузить релизы.");
      } finally {
        setLoading(false);
      }
    };

    if (isAuthorized) {
      void load();
    }
  }, [isAuthorized]);

  const handleCopyInfo = async (release: ReleaseRow) => {
    const text = `${release.artist_name} — ${release.track_name} — ${
      release.author_full_name || "Автор не указан"
    }`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore clipboard errors
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 text-text flex items-center justify-center">
        <div className="rounded-[24px] border border-white/5 bg-surface/80 px-6 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl text-center max-w-sm">
          <h1 className="mb-2 text-[20px] font-semibold tracking-tight">
            Доступ запрещён
          </h1>
          <p className="text-[14px] text-text-muted">
            Этот раздел доступен только администраторам лейбла.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 pb-10 text-text">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 font-sans">
        <header className="space-y-1">
          <h1 className="text-[26px] font-extrabold tracking-tight">
            Label Admin Dashboard
          </h1>
          <p className="text-[13px] text-text-muted leading-relaxed">
            Быстрый обзор релизов, текстов и WAV‑файлов.
          </p>
        </header>

        {loading && (
          <div className="rounded-[24px] border border-white/5 bg-surface/80 px-6 py-5 text-[14px] text-text-muted shadow-[0_20px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            Загружаем релизы...
          </div>
        )}

        {error && (
          <div className="rounded-[24px] border border-red-500/40 bg-red-950/40 px-6 py-4 text-[13px] text-red-200">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <AnimatePresence>
            {releases.map((release) => (
              <motion.div
                key={release.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="rounded-[24px] border border-white/5 bg-surface/80 px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1 min-w-0">
                    <div className="text-[12px] uppercase tracking-[0.18em] text-text-muted">
                      {new Date(release.created_at).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </div>
                    <div className="text-[15px] font-semibold">
                      {release.artist_name} — {release.track_name}
                    </div>
                    <div className="text-[13px] text-text-muted">
                      Автор (ФИО):{" "}
                      {release.author_full_name || "не указано"}
                    </div>
                    <div className="text-[12px] text-text-muted">
                      Жанр: {release.genre || "—"} · Настроение:{" "}
                      {release.mood || "—"}
                    </div>
                  </div>

                  {release.artwork_url && (
                    <a
                      href={release.artwork_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block flex-shrink-0 overflow-hidden rounded-[16px] border border-white/10 bg-[#101012]"
                    >
                      <img
                        src={release.artwork_url}
                        alt={`${release.track_name} artwork`}
                        className="h-[80px] w-[80px] object-cover"
                      />
                    </a>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {release.audio_url && (
                      <audio
                        src={release.audio_url}
                        controls
                        className="w-full max-w-xs rounded-lg bg-[#101012]"
                      />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedLyricsId((prev) =>
                          prev === release.id ? null : release.id
                        )
                      }
                      className="rounded-[999px] border border-white/15 px-3 py-1.5 text-[12px] text-text-muted hover:border-white/40 hover:text-white transition-colors"
                    >
                      {expandedLyricsId === release.id
                        ? "Скрыть текст"
                        : "Текст песни"}
                    </button>

                    {release.audio_url && (
                      <a
                        href={release.audio_url}
                        download
                        className="rounded-[999px] border border-white/15 px-3 py-1.5 text-[12px] text-text-muted hover:border-white/40 hover:text-white transition-colors"
                      >
                        Скачать WAV
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleCopyInfo(release)}
                      className="rounded-[999px] border border-white/15 px-3 py-1.5 text-[12px] text-text-muted hover:border-white/40 hover:text-white transition-colors"
                    >
                      Скопировать инфо
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedLyricsId === release.id && release.lyrics && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="mt-3 rounded-[16px] border border-white/5 bg-[#101012] p-3 text-[12px] leading-relaxed text-text-muted max-h-[260px] overflow-y-auto"
                    >
                      {release.lyrics.split("\n").map((line, idx) => (
                        <p key={idx}>{line}</p>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>

          {!loading && releases.length === 0 && !error && (
            <div className="rounded-[24px] border border-white/5 bg-surface/80 px-6 py-5 text-[13px] text-text-muted shadow-[0_20px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              Пока нет загруженных релизов. Как только артисты отправят треки,
              они появятся здесь.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

