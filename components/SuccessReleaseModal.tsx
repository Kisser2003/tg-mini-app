"use client";

import type { CSSProperties } from "react";
import type { CreateReleaseSuccessSummary } from "@/features/release/createRelease/types";
import { ReleaseSleeve } from "@/components/ReleaseSleeve";
import { MODERATION_SLA_HOURS } from "@/lib/release-next-step";

/**
 * Хореография экрана: конверт поднимается → наклейка «на проверке» шлёпается на него →
 * текст и кнопки проявляются следом. Момент удара наклейки — для синхронной хаптики.
 */
export const SUCCESS_STICKER_DELAY_MS = 420;
export const SUCCESS_STICKER_IMPACT_MS = SUCCESS_STICKER_DELAY_MS + 300;

const delay = (ms: number) => ({ "--omf-delay": `${ms}ms` }) as CSSProperties;

type Props = {
  summary: CreateReleaseSuccessSummary;
  /** Решение придёт сообщением от бота (Mini App). На сайте без Telegram — нет. */
  notifiesInTelegram: boolean;
  onGoHome: () => void;
  onUploadAnother: () => void;
};

export function SuccessReleaseModal({ summary, notifiesInTelegram, onGoHome, onUploadAnother }: Props) {
  const title = (summary.releaseName ?? summary.trackName)?.trim() || "Релиз";

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center pt-6 text-center">
      <div className="omf-cover-in w-[68%] max-w-[260px]">
        <ReleaseSleeve
          seed={`${summary.artistName}-${title}`}
          title={title}
          artist={summary.artistName}
          coverUrl={summary.coverUrl ?? null}
          status="processing"
          size="hero"
          priority
          stickerSlapDelayMs={SUCCESS_STICKER_DELAY_MS}
        />
      </div>

      <h1
        className="omf-reveal mt-9 break-words text-[32px] font-extrabold leading-[0.95] tracking-[-0.04em]"
        style={delay(260)}
      >
        Отправлено на проверку
      </h1>
      <p className="omf-reveal mt-3 max-w-[32ch] text-[15px] leading-relaxed text-omf-graphite" style={delay(340)}>
        Модератор проверит «{title}», обычно до {MODERATION_SLA_HOURS} часов.{" "}
        {notifiesInTelegram
          ? "Когда будет решение, напишем в этот бот. Статус всегда виден в списке релизов."
          : "Когда будет решение, статус обновится в списке релизов."}
      </p>

      <div className="mt-10 flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={onGoHome}
          className="omf-btn-primary omf-reveal h-14 w-full text-[16px]"
          style={delay(440)}
        >
          К моим релизам
        </button>
        <button
          type="button"
          onClick={onUploadAnother}
          className="omf-btn-secondary omf-reveal h-14 w-full text-[16px]"
          style={delay(500)}
        >
          Создать ещё один релиз
        </button>
      </div>
    </div>
  );
}
