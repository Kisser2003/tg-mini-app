"use client";

import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { FAQ_TOOLTIP_TEXT_BY_TOPIC, type FaqTopicKey } from "@/components/library/faq-data";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ReleaseFieldTooltipProps = {
  topic: FaqTopicKey;
  children?: ReactNode;
  className?: string;
};

/**
 * Изолированный tooltip для форм создания релиза.
 * Текст берется из общего FAQ-источника, чтобы правила не расходились.
 */
export function ReleaseFieldTooltip({ topic, children, className }: ReleaseFieldTooltipProps) {
  const tooltipText = FAQ_TOOLTIP_TEXT_BY_TOPIC[topic];

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children ?? (
            <button
              type="button"
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded-full text-omf-faint transition-colors hover:text-omf-ink omf-focus",
                className,
              )}
              aria-label="Показать подсказку"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[260px] rounded-control border-omf-line-strong bg-omf-surface-2 px-3 py-2.5 text-[13px] leading-relaxed text-omf-ink"
        >
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
