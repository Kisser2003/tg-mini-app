"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CreateShell } from "@/features/release/createRelease/components/CreateShell";
import { StepGate } from "@/features/release/createRelease/components/StepGate";
import { useStepGuard } from "@/features/release/createRelease/guards";
import { ensureDraftRelease, uploadArtworkForDraft } from "@/features/release/createRelease/actions";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import { FileUploader } from "@/components/FileUploader";
import { FormFieldError } from "@/components/FormFieldError";
import { debugInit } from "@/lib/debug";
import { logClientError } from "@/lib/logger";
import { triggerHaptic } from "@/lib/telegram";
import { toast } from "sonner";

export default function CreateAssetsPage() {
  const router = useRouter();
  const guard = useStepGuard("assets");

  const artworkUrl = useCreateReleaseDraftStore((s) => s.artworkUrl);
  // artworkFile lives in Zustand memory (non-persisted) so it survives navigation
  // within the same session. FileUploader receives it as initialFile to restore its UI.
  const artworkFile = useCreateReleaseDraftStore((s) => s.artworkFile);
  const setArtworkFile = useCreateReleaseDraftStore((s) => s.setArtworkFile);
  const submitError = useCreateReleaseDraftStore((s) => s.submitError);
  const setSubmitError = useCreateReleaseDraftStore((s) => s.setSubmitError);
  const releaseId = useCreateReleaseDraftStore((s) => s.releaseId);

  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setSubmitError(null);
  }, [setSubmitError]);

  // "Next" is enabled when a file has been chosen in this session OR when artwork
  // was already uploaded in a previous step (artworkUrl persisted in store).
  const canGoNext = useMemo(
    () => Boolean(artworkFile) || Boolean(artworkUrl),
    [artworkFile, artworkUrl]
  );

  const handleNext = useCallback(async () => {
    triggerHaptic("light");
    debugInit("create/assets", "handleNext start", {
      hasArtworkUrl: Boolean(artworkUrl),
      hasArtworkFile: Boolean(artworkFile),
      hasReleaseId: Boolean(releaseId)
    });
    if (artworkUrl && !artworkFile) {
      debugInit("create/assets", "skip upload, artwork already exists");
      router.push("/create/tracks");
      return;
    }
    if (!artworkFile) {
      debugInit("create/assets", "blocked: artwork file missing");
      setSubmitError("Загрузите обложку (JPG/PNG).");
      return;
    }
    setIsUploading(true);
    setSubmitError(null);
    try {
      if (!releaseId) {
        debugInit("create/assets", "ensureDraftRelease start");
        const draft = await ensureDraftRelease();
        if (!draft) {
          debugInit("create/assets", "ensureDraftRelease returned null");
          const errMsg = useCreateReleaseDraftStore.getState().submitError;
          if (errMsg) toast.error(errMsg);
          return;
        }
        debugInit("create/assets", "ensureDraftRelease success", { releaseId: draft.id });
      }
      debugInit("create/assets", "uploadArtworkForDraft start");
      const url = await uploadArtworkForDraft(artworkFile);
      if (!url) {
        debugInit("create/assets", "uploadArtworkForDraft returned empty URL");
        const errMsg = useCreateReleaseDraftStore.getState().submitError;
        if (errMsg) toast.error(errMsg);
        return;
      }
      debugInit("create/assets", "uploadArtworkForDraft success", { hasUrl: true });
      router.push("/create/tracks");
    } catch (e: unknown) {
      console.error("[CreateAssetsPage] Upload error:", e);
      logClientError({
        error: e,
        screenName: "CreateAssets_upload",
        route: "/create/assets"
      });
      setSubmitError(
        e instanceof Error ? e.message : "Произошла ошибка при загрузке обложки."
      );
      toast.error(
        e instanceof Error ? e.message : "Произошла ошибка при загрузке обложки."
      );
    } finally {
      debugInit("create/assets", "handleNext finished");
      setIsUploading(false);
    }
  }, [artworkFile, artworkUrl, releaseId, router, setSubmitError]);

  return (
    <CreateShell title="Релиз · Обложка">
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
              Загрузите обложку релиза. Минимальное разрешение: 3000×3000.
            </p>
            <div className="mt-4">
              <FileUploader
                label="Artwork (JPG/PNG)"
                accept=".jpg,.jpeg,.png"
                maxSizeMb={20}
                type="cover"
                initialFile={artworkFile}
                initialPreviewUrl={artworkUrl}
                onFileChange={setArtworkFile}
              />
            </div>

            {artworkUrl && !artworkFile && (
              <p className="mt-3 text-[11px] text-white/45">
                Обложка уже загружена. Можно перейти дальше без повторной загрузки.
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={!canGoNext || isUploading}
            onClick={handleNext}
            className="inline-flex h-[56px] w-full items-center justify-center rounded-[20px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[16px] font-semibold text-white shadow-[0_14px_40px_rgba(88,80,236,0.6)] disabled:opacity-60 disabled:shadow-none"
          >
            {isUploading ? "Загружаем..." : "Далее"}
          </button>

          <FormFieldError message={submitError ?? undefined} messageClassName="text-center" />
        </div>
      )}
    </CreateShell>
  );
}
