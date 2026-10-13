"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { faqTopicHref, type RejectionSummary } from "@/lib/rejection-reasons";
import { cn } from "@/lib/utils";

type Props = {
  summary: RejectionSummary;
  /** «Исправить и отправить снова»: переводит релиз в черновик и открывает мастер. */
  onFix: () => void;
  fixing?: boolean;
  /** Заголовок блока; в модалке заголовок уже есть снаружи. */
  showTitle?: boolean;
  className?: string;
};

/** Почему вернули релиз и как быстро исправить. Общий для библиотеки и экрана релиза. */
export function RejectionNotice({ summary, onFix, fixing = false, showTitle = true, className }: Props) {
  return (
    <section
      aria-labelledby={showTitle ? "rejection-notice-title" : undefined}
      aria-label={showTitle ? undefined : "Почему вернули релиз"}
      className={cn("rounded-control border border-omf-red p-4", className)}
    >
      {showTitle ? (
        <h2 id="rejection-notice-title" className="text-[16px] font-bold tracking-tight">
          Почему вернули
        </h2>
      ) : null}
      <p
        className={cn(
          "whitespace-pre-wrap break-words text-[15px] leading-relaxed",
          showTitle && "mt-1.5",
          summary.isFallback ? "text-omf-graphite" : "text-omf-ink"
        )}
      >
        {summary.message}
      </p>

      {summary.reasons.length > 0 ? (
        <ul className="mt-3 border-t border-omf-line">
          {summary.reasons.map((r) => (
            <li key={r.key} className="border-b border-omf-line py-2.5">
              <p className="text-[14px] font-medium text-omf-ink">{r.label}</p>
              <p className="mt-0.5 text-[14px] leading-snug text-omf-graphite">{r.hint}</p>
              {r.faqTopic ? (
                <Link
                  href={faqTopicHref(r.faqTopic)}
                  className="omf-focus mt-1 inline-flex items-center gap-0.5 rounded-full text-[13px] text-omf-ultra-text hover:text-omf-ink"
                >
                  Требования
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 text-[13px] text-omf-graphite">
        Файлы уже загружены: поменяй только то, что указано.
      </p>
      <button
        type="button"
        className="omf-btn-primary mt-3 w-full disabled:opacity-50"
        disabled={fixing}
        onClick={onFix}
      >
        {fixing ? "Открываем…" : "Исправить и отправить снова"}
      </button>
    </section>
  );
}
