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
                "inline-flex h-5 w-5 items-center justify-center rounded-full text-white/45 transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40",
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
          className="max-w-[260px] border-white/[0.12] bg-[#111217]/95 px-3 py-2 text-xs leading-relaxed text-white/80 shadow-2xl"
        >
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
