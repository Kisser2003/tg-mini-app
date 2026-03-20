"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreateShell } from "@/features/release/createRelease/components/CreateShell";
import { StepGate } from "@/features/release/createRelease/components/StepGate";
import { useStepGuard } from "@/features/release/createRelease/guards";
import {
  useCreateReleaseDraftStore
} from "@/features/release/createRelease/store";
import { submitTracksAndFinalize } from "@/features/release/createRelease/actions";
import { UploadProgress } from "@/components/UploadProgress";
import { triggerHaptic } from "@/lib/telegram";

export default function CreateReviewPage() {
  const router = useRouter();
  const guard = useStepGuard("review");

  const metadata = useCreateReleaseDraftStore((s) => s.metadata);
  const artworkUrl = useCreateReleaseDraftStore((s) => s.artworkUrl);
  const tracks = useCreateReleaseDraftStore((s) => s.tracks);
  const trackFiles = useCreateReleaseDraftStore((s) => s.trackFiles);
  const submitError = useCreateReleaseDraftStore((s) => s.submitError);
  const setSubmitError = useCreateReleaseDraftStore((s) => s.setSubmitError);
  const submitStatus = useCreateReleaseDraftStore((s) => s.submitStatus);
  const submitStage = useCreateReleaseDraftStore((s) => s.submitStage);
  const submitProgress = useCreateReleaseDraftStore((s) => s.submitProgress);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const missingFiles = useMemo(() => tracks.some((_t, i) => !trackFiles[i]), [trackFiles, tracks]);
  const stageLabel = useMemo(() => {
    if (submitStage === "preparing") return "Подготавливаем релиз";
    if (submitStage === "uploading_tracks") return "Загружаем WAV-файлы";
    if (submitStage === "finalizing") return "Передаем релиз в модерацию";
    if (submitStage === "done") return "Готово";
    if (submitStage === "error") return "Ошибка отправки";
    return "Ожидание отправки";
  }, [submitStage]);

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    if (missingFiles) {
      setSubmitError("Не хватает WAV-файлов. Вернитесь на шаг «Треки» и загрузите все файлы.");
      return;
    }
    triggerHaptic("medium");
    const files = trackFiles.filter(Boolean) as File[];
    setIsSubmitting(true);
    const loadingId = toast.loading("Загрузка WAV и отправка в модерацию…");
    const ok = await submitTracksAndFinalize({ files });
    setIsSubmitting(false);
    if (!ok) {
      const msg = useCreateReleaseDraftStore.getState().submitError;
      toast.error(msg ?? "Не удалось отправить релиз", { id: loadingId });
      return;
    }
    toast.success("Релиз передан в модерацию", { id: loadingId });
    router.push("/create/success");
  }, [missingFiles, router, setSubmitError, trackFiles]);

  return (
    <CreateShell title="Релиз · Проверка">
      {!guard.allowed ? (
        <StepGate
          title={guard.title}
          description={guard.description}
          actionLabel={guard.actionLabel}
          onAction={() => router.push(`/create/${guard.redirectTo}`)}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-white/[0.08] bg-surface/80 px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
            <p className="text-[13px] text-text-muted leading-relaxed">
              Проверьте данные перед отправкой. Отправка начнёт загрузку WAV и передачу релиза в
              модерацию.
            </p>

            <div className="mt-4 space-y-3 text-[13px]">
              <div className="rounded-[18px] bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Паспорт</p>
                <p className="mt-1 text-white">
                  {metadata.artists?.[0]?.name || "Артист"} — {metadata.releaseTitle || "Релиз"}
                </p>
                <p className="mt-1 text-white/55 text-[12px]">
                  {metadata.releaseType} · {metadata.genre || "жанр"} · {metadata.releaseDate || "дата"}
                </p>
              </div>

              <div className="rounded-[18px] bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Обложка</p>
                <p className="mt-1 text-white/70">
                  {artworkUrl ? "Загружена" : "Не загружена"}
                </p>
              </div>

              <div className="rounded-[18px] bg-black/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Треки</p>
                <ul className="mt-2 space-y-1 text-white/80">
                  {tracks.map((t, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <li key={i} className="flex items-center justify-between gap-3">
                      <span className="truncate">
                        {i + 1}. {t.title || "Без названия"}
                      </span>
                      <span className="text-[11px] text-white/35">
                        {trackFiles[i] ? "WAV ✓" : "WAV ✕"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting || submitStatus === "submitting"}
            onClick={handleSubmit}
            className="inline-flex h-[56px] w-full items-center justify-center rounded-[20px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[16px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.6)] disabled:opacity-60 disabled:shadow-none"
          >
            {isSubmitting ? "Отправляем..." : "Отправить релиз"}
          </button>

          {(submitStatus === "submitting" || submitStatus === "error") && (
            <UploadProgress label={stageLabel} progress={submitProgress} />
          )}

          {submitError && (
            <p className="text-center text-[11px] text-red-400">
              {submitError} Попробуйте повторно отправить релиз после исправления проблемы.
            </p>
          )}
        </div>
      )}
    </CreateShell>
  );
}

