"use client";

import type { CreateReleaseSuccessSummary } from "@/features/release/createRelease/types";
import { ReleaseSleeve } from "@/components/ReleaseSleeve";

type Props = {
  summary: CreateReleaseSuccessSummary;
  onGoHome: () => void;
  onUploadAnother: () => void;
};

export function SuccessReleaseModal({ summary, onGoHome, onUploadAnother }: Props) {
  const title = (summary.releaseName ?? summary.trackName)?.trim() || "Релиз";

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center pt-6 text-center">
      <div className="w-[68%] max-w-[260px]">
        <ReleaseSleeve
          seed={`${summary.artistName}-${title}`}
          title={title}
          artist={summary.artistName}
          coverUrl={summary.coverUrl ?? null}
          status="processing"
          size="hero"
        />
      </div>

      <h1 className="mt-9 break-words text-[32px] font-extrabold leading-[0.95] tracking-[-0.04em]">
        Отправлено на проверку
      </h1>
      <p className="mt-3 max-w-[32ch] text-[15px] leading-relaxed text-omf-graphite">
        Модератор проверит «{title}» — обычно до 24 часов — и напишет в этот бот, когда будет решение. Статус релиза всегда виден в списке релизов.
      </p>

      <div className="mt-10 flex w-full flex-col gap-3">
        <button type="button" onClick={onGoHome} className="omf-btn-primary h-14 w-full text-[16px]">
          К моим релизам
        </button>
        <button type="button" onClick={onUploadAnother} className="omf-btn-secondary h-14 w-full text-[16px]">
          Создать ещё один релиз
        </button>
      </div>
    </div>
  );
}
