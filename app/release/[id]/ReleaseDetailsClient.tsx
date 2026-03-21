"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Link2, ShieldCheck } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { debugInit } from "@/lib/debug";
import { getReleaseStatusMeta, normalizeReleaseStatus } from "@/lib/release-status";
import { isAdminUi } from "@/lib/admin";
import { supabase } from "@/lib/supabase";
import { getTelegramUserId, initTelegramWebApp } from "@/lib/telegram";

type ReleaseDetailsRow = {
  id: string;
  user_id: number;
  artist_name: string;
  track_name: string;
  artwork_url: string | null;
  audio_url: string | null;
  release_type: string;
  genre: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

const RELEASE_DETAILS_TIMEOUT_MS = 12000;
const ARTWORK_SIZES = "(max-width: 768px) 100vw, 33vw";

export default function ReleaseDetailsClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [release, setRelease] = useState<ReleaseDetailsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    debugInit("release/details", "init start");
    initTelegramWebApp();
    setUserId(getTelegramUserId());
    debugInit("release/details", "init done");
  }, []);

  useEffect(() => {
    if (!params.id) return;
    if (userId == null && process.env.NODE_ENV === "production") {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    const load = async () => {
      setLoading(true);
      setError(null);
      const startedAt = Date.now();
      debugInit("release/details", "load start", { releaseId: params.id, userId });
      try {
        const isAdminView = isAdminUi();
        const base = supabase
          .from("releases")
          .select(
            "id, user_id, artist_name, track_name, artwork_url, audio_url, release_type, genre, status, error_message, created_at"
          )
          .eq("id", params.id);
        const filtered = isAdminView ? base : base.eq("user_id", userId!);
        const queryPromise = Promise.resolve(filtered.maybeSingle());
        queryPromise.catch(() => {});
        const timeoutPromise = new Promise<Awaited<typeof queryPromise>>((_, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(
              new Error(
                `Запрос превысил таймаут (${RELEASE_DETAILS_TIMEOUT_MS} мс). Попробуйте снова.`
              )
            );
          }, RELEASE_DETAILS_TIMEOUT_MS);
        });

        const { data, error: dbError } = await Promise.race([
          queryPromise,
          timeoutPromise
        ]);
        if (timeoutId != null) {
          window.clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (dbError) throw dbError;
        if (!cancelled) {
          setRelease((data as ReleaseDetailsRow | null) ?? null);
        }
        debugInit("release/details", "load success", {
          releaseId: params.id,
          hasData: Boolean(data),
          durationMs: Date.now() - startedAt
        });
      } catch (e: unknown) {
        if (timeoutId != null) {
          window.clearTimeout(timeoutId);
          timeoutId = null;
        }
        console.error("[release/details] load failed", e);
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Не удалось загрузить релиз.");
        }
      } finally {
        if (!cancelled) setLoading(false);
        debugInit("release/details", "load finished", {
          releaseId: params.id,
          durationMs: Date.now() - startedAt
        });
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [params.id, userId]);

  const moderationChecklist = useMemo(
    () => [
      { title: "Проверка метаданных", done: normalizeReleaseStatus(release?.status) !== "failed" },
      { title: "Проверка обложки", done: normalizeReleaseStatus(release?.status) !== "draft" },
      { title: "Доставка на платформы", done: normalizeReleaseStatus(release?.status) === "ready" }
    ],
    [release]
  );

  if (userId == null && process.env.NODE_ENV === "production") {
    return (
      <GlassCard className="p-5">
        <h1 className="text-xl font-semibold tracking-tight">Карточка релиза</h1>
        <p className="mt-2 text-sm text-white/65">Открой приложение из Telegram для доступа к релизу.</p>
      </GlassCard>
    );
  }

  if (loading) {
    return <GlassCard className="p-5 text-sm text-white/70">Загружаем карточку релиза...</GlassCard>;
  }

  if (error) {
    return <GlassCard className="p-5 text-sm text-rose-200">{error}</GlassCard>;
  }

  if (!release) {
    return (
      <GlassCard className="p-5">
        <h1 className="text-xl font-semibold tracking-tight">Релиз не найден</h1>
        <p className="mt-2 text-sm text-white/65">Проверь ссылку или доступ к релизу.</p>
      </GlassCard>
    );
  }

  const statusMeta = getReleaseStatusMeta(release.status);

  const isReady = normalizeReleaseStatus(release.status) === "ready";

  return (
    <div className="flex flex-col gap-4 pb-10">
      <GlassCard className="p-5" variant={isReady ? "success" : "default"}>
        <motion.button
          type="button"
          whileHover={{ scale: 0.99 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Назад
        </motion.button>
        <div className="flex items-center gap-3">
          {release.artwork_url ? (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/15">
              <Image
                src={release.artwork_url}
                alt={release.track_name}
                fill
                sizes={ARTWORK_SIZES}
                className="object-cover"
                priority
              />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-black/30 text-[10px] text-white/45">
              NO ART
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{release.track_name}</h1>
            <p className="text-sm text-white/60">{release.artist_name}</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium tracking-tight text-white/85">Параметры релиза</p>
          <p className="text-sm font-semibold">{release.release_type}</p>
        </div>
        <div className="space-y-2 rounded-2xl border border-white/10 bg-black/25 p-3 text-sm text-white/75">
          <p>Жанр: {release.genre}</p>
          <p>Создан: {new Date(release.created_at).toLocaleString("ru-RU")}</p>
          <p>ID: {release.id}</p>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <p className="mb-2 inline-flex items-center gap-2 text-sm text-white/75">
          <ShieldCheck className="h-4 w-4" />
          Статус модерации
        </p>
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusMeta.badgeClassName} ${statusMeta.badgeGlowClassName ?? ""} ${statusMeta.badgeShimmerClassName ?? ""}`}
        >
          {statusMeta.label}
        </span>
        <p className="mt-3 text-sm text-white/70">
          {release.error_message?.trim()
            ? release.error_message
            : normalizeReleaseStatus(release.status) === "failed"
              ? "Причина отклонения не указана. Обратитесь в поддержку OMF."
              : "Ошибок модерации не зафиксировано."}
        </p>

        <div className="mt-4 space-y-2">
          {moderationChecklist.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 0.995 }}
              whileTap={{ scale: 0.98 }}
              transition={{ delay: index * 0.06, type: "spring", stiffness: 280, damping: 24 }}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
            >
              <motion.span
                initial={false}
                animate={{
                  backgroundColor: item.done ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.06)",
                  borderColor: item.done ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.15)"
                }}
                className="inline-flex h-5 w-5 items-center justify-center rounded-md border"
              >
                {item.done && <Check className="h-3.5 w-3.5 text-emerald-300" />}
              </motion.span>
              <span className="text-sm text-white/75">{item.title}</span>
            </motion.div>
          ))}
        </div>

        {release.audio_url && (
          <motion.a
            href={release.audio_url}
            target="_blank"
            rel="noreferrer"
            whileHover={{ scale: 0.99 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-sky-300/35 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100"
          >
            <Link2 className="h-3.5 w-3.5" />
            Открыть аудио
          </motion.a>
        )}
      </GlassCard>
    </div>
  );
}
