"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CreateShell } from "@/features/release/createRelease/components/CreateShell";
import { StepGate } from "@/features/release/createRelease/components/StepGate";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import { SuccessReleaseModal } from "@/components/SuccessReleaseModal";
import { triggerHaptic } from "@/lib/telegram";

type LeavingIntent = "home" | "create" | null;

export default function CreateSuccessPage() {
  const router = useRouter();
  const leavingRef = useRef<LeavingIntent>(null);
  const summary = useCreateReleaseDraftStore((s) => s.successSummary);
  const resetDraft = useCreateReleaseDraftStore((s) => s.resetDraft);
  const resetSubmissionUi = useCreateReleaseDraftStore((s) => s.resetSubmissionUi);

  useEffect(() => {
    resetSubmissionUi();
  }, [resetSubmissionUi]);

  useEffect(() => {
    if (summary) {
      try {
        triggerHaptic("success");
      } catch {
        /* ignore */
      }
    }
  }, [summary]);

  const leaving = leavingRef.current;

  if (leaving) {
    return (
      <CreateShell>
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-omf-line border-t-omf-ultra"
            aria-hidden="true"
          />
          <p className="text-center text-[14px] text-omf-graphite">
            {leaving === "home" ? "Переход на главную…" : "Открываем новый релиз…"}
          </p>
        </div>
      </CreateShell>
    );
  }

  return (
    <CreateShell>
      {!summary ? (
        <StepGate
          title="Нет данных об отправке"
          description="Похоже, релиз ещё не отправлен. Начни с паспорта релиза."
          actionLabel="Начать релиз"
          onAction={() => router.push("/create/metadata")}
        />
      ) : (
        <SuccessReleaseModal
          summary={summary}
          onGoHome={() => {
            leavingRef.current = "home";
            resetDraft();
            router.push("/library?fromCreate=1");
          }}
          onUploadAnother={() => {
            leavingRef.current = "create";
            resetDraft();
            router.push("/create/metadata");
          }}
        />
      )}
    </CreateShell>
  );
}
