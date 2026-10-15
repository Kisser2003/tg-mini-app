"use client";

import { useEffect, useState } from "react";
import { BorderBeam } from "border-beam";
import type { CreateReleaseSuccessSummary } from "@/features/release/createRelease/types";
import { ReleaseSleeve } from "@/components/ReleaseSleeve";
import { MODERATION_SLA_HOURS } from "@/lib/release-next-step";

type Props = {
  summary: CreateReleaseSuccessSummary;
  /** Решение придёт сообщением от бота (Mini App). На сайте без Telegram — нет. */
  notifiesInTelegram: boolean;
  onGoHome: () => void;
  onUploadAnother: () => void;
};

export function SuccessReleaseModal({ summary, notifiesInTelegram, onGoHome, onUploadAnother }: Props) {
  const title = (summary.releaseName ?? summary.trackName)?.trim() || "Релиз";
  /* border-beam при SSR экранирует кавычки в своём <style> → ошибка гидратации. Луч только на клиенте. */
  const [beamReady, setBeamReady] = useState(false);
  useEffect(() => setBeamReady(true), []);

  const sleeve = (
    <div className="rounded-sleeve">
      <ReleaseSleeve
        seed={`${summary.artistName}-${title}`}
        title={title}
        artist={summary.artistName}
        coverUrl={summary.coverUrl ?? null}
        status="processing"
        size="hero"
      />
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center pt-6 text-center">
      <div className="w-[68%] max-w-[260px]">
        {beamReady ? (
          <BorderBeam size="md" theme="dark" strength={0.9}>
            {sleeve}
          </BorderBeam>
        ) : (
          sleeve
        )}
      </div>

      <h1 className="mt-9 break-words text-[32px] font-extrabold leading-[0.95] tracking-[-0.04em]">
        Отправлено на проверку
      </h1>
      <p className="mt-3 max-w-[32ch] text-[15px] leading-relaxed text-omf-graphite">
        Модератор проверит «{title}», обычно до {MODERATION_SLA_HOURS} часов.{" "}
        {notifiesInTelegram
          ? "Когда будет решение, напишем в этот бот. Статус всегда виден в списке релизов."
          : "Когда будет решение, статус обновится в списке релизов."}
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
