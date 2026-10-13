"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateShell } from "@/features/release/createRelease/components/CreateShell";
import { StepGate } from "@/features/release/createRelease/components/StepGate";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import { SUCCESS_STICKER_IMPACT_MS, SuccessReleaseModal } from "@/components/SuccessReleaseModal";
import { hapticMap } from "@/lib/haptic-map";
import { getTelegramUserId, isTelegramMiniApp } from "@/lib/telegram";

type LeavingIntent = "home" | "create" | null;

export default function CreateSuccessPage() {
  const router = useRouter();
  /** State, а не ref: экран «Переход…» должен перерисоваться до навигации. */
  const [leaving, setLeaving] = useState<LeavingIntent>(null);
  const [notifiesInTelegram, setNotifiesInTelegram] = useState(false);
  const summary = useCreateReleaseDraftStore((s) => s.successSummary);
  const resetDraft = useCreateReleaseDraftStore((s) => s.resetDraft);
  const resetSubmissionUi = useCreateReleaseDraftStore((s) => s.resetSubmissionUi);

  useEffect(() => {
    resetSubmissionUi();
    setNotifiesInTelegram(isTelegramMiniApp() || getTelegramUserId() != null);
  }, [resetSubmissionUi]);

  /** «Успех» в руку — в момент, когда наклейка шлёпается на обложку, а не раньше картинки. */
  useEffect(() => {
    if (!summary) return;
    const t = window.setTimeout(() => hapticMap.notificationSuccess(), SUCCESS_STICKER_IMPACT_MS);
    return () => window.clearTimeout(t);
  }, [summary]);

  if (leaving) {
    return (
      <CreateShell>
        <div className="omf-delayed-in flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4">
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
          notifiesInTelegram={notifiesInTelegram}
          onGoHome={() => {
            hapticMap.impactLight();
            setLeaving("home");
            resetDraft();
            router.push("/library?fromCreate=1");
          }}
          onUploadAnother={() => {
            hapticMap.impactLight();
            setLeaving("create");
            resetDraft();
            router.push("/create/metadata");
          }}
        />
      )}
    </CreateShell>
  );
}
