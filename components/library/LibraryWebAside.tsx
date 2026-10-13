"use client";

import { useEffect, useMemo, useState } from "react";
import { FAQ_ITEMS } from "@/components/library/faq-data";
import type { FaqTopicKey } from "@/lib/faq-topics";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { hapticMap } from "@/lib/haptic-map";

/**
 * Контент страницы FAQ (/requirements): фактические правила OMF, а не общие шаблоны.
 */
export function LibraryWebAside({ openTopic }: { openTopic?: FaqTopicKey | null } = {}) {
  const [query, setQuery] = useState("");

  /** Переход из «Почему вернули»: раздел уже раскрыт, прокручиваем к нему. */
  useEffect(() => {
    if (!openTopic) return;
    const el = document.getElementById(`faq-${openTopic}`);
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [openTopic]);

  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return FAQ_ITEMS;

    return FAQ_ITEMS.filter((item) => {
      const haystack = `${item.title} ${item.searchText}`.toLocaleLowerCase("ru-RU");
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Найти: аудио, обложка, модерация"
        aria-label="Поиск по вопросам"
        className="omf-focus min-h-[48px] w-full rounded-control border border-omf-line bg-omf-surface px-4 py-3 text-[16px] text-omf-ink outline-none placeholder:text-omf-faint focus:border-omf-ultra"
      />

      <Accordion
        type="multiple"
        defaultValue={openTopic ? [openTopic] : undefined}
        onValueChange={() => hapticMap.selection()}
        className="border-t border-omf-line"
      >
        {filteredItems.map((item) => {
          const Icon = item.icon;

          return (
            <AccordionItem
              key={item.id}
              id={`faq-${item.id}`}
              value={item.id}
              className="scroll-mt-4 border-b border-omf-line"
            >
              <AccordionTrigger className="px-0 py-4 text-left text-[17px] font-bold tracking-[-0.01em] text-omf-ink hover:no-underline">
                <span className="mr-3 inline-flex items-center gap-3">
                  <Icon className={cn("h-[18px] w-[18px] shrink-0", item.iconClassName)} aria-hidden />
                  <span>{item.title}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-5 pl-[30px] text-[15px] text-omf-graphite">
                {item.content}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {!filteredItems.length && (
        <p className="text-[15px] text-omf-graphite">Ничего не нашлось. Попробуй другое слово.</p>
      )}

      <p className="text-[13px] leading-relaxed text-omf-faint">
        Правила площадок иногда меняются. Если случай нестандартный (сборник, кавер, сложные права),
        напиши в поддержку до отправки релиза.
      </p>
    </div>
  );
}
