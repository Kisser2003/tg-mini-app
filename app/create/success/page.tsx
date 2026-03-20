"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CreateShell } from "@/features/release/createRelease/components/CreateShell";
import { StepGate } from "@/features/release/createRelease/components/StepGate";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import { SuccessScreen } from "@/components/SuccessScreen";
import { triggerHaptic } from "@/lib/telegram";

export default function CreateSuccessPage() {
  const router = useRouter();
  const summary = useCreateReleaseDraftStore((s) => s.successSummary);
  const resetDraft = useCreateReleaseDraftStore((s) => s.resetDraft);

  useEffect(() => {
    if (summary) {
      try {
        triggerHaptic("success");
      } catch {
        /* ignore */
      }
    }
  }, [summary]);

  return (
    <CreateShell title="Релиз · Готово">
      {!summary ? (
        <StepGate
          title="Нет данных об отправке"
          description="Похоже, вы ещё не отправили релиз. Вернитесь к началу мастера."
          actionLabel="Перейти к паспорту"
          onAction={() => router.push("/create/metadata")}
        />
      ) : (
        <SuccessScreen
          summary={summary}
          onGoHome={() => {
            resetDraft();
            router.push("/dashboard");
          }}
          onUploadAnother={() => {
            resetDraft();
            router.push("/create/metadata");
          }}
        />
      )}
    </CreateShell>
  );
}
