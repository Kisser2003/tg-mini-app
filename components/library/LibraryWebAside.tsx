"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { FAQ_ITEMS } from "@/components/library/faq-data";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Контент страницы FAQ (/requirements): фактические правила OMF, а не общие шаблоны.
 */
export function LibraryWebAside() {
  const [query, setQuery] = useState("");

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
      <div className="sticky top-0 z-20 rounded-xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(12,12,15,0.96),rgba(12,12,15,0.9))] p-2.5 backdrop-blur-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по FAQ: аудио, обложка, модерация..."
            className="h-10 rounded-lg border-white/[0.08] bg-white/[0.03] pl-9 text-sm text-white/85 placeholder:text-white/35 focus-visible:ring-indigo-400/35"
            aria-label="Поиск по FAQ"
          />
        </div>
      </div>

      <Accordion type="multiple" className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md">
        {filteredItems.map((item) => {
          const Icon = item.icon;

          return (
            <AccordionItem
              key={item.id}
              value={item.id}
              className={cn(
                "border-b border-white/[0.06] px-3 last:border-b-0 sm:px-4",
                item.tone === "warning" && "bg-amber-500/[0.04]",
                item.tone === "gradient" && "bg-gradient-to-br from-indigo-500/[0.08] to-purple-600/[0.03]",
              )}
            >
              <AccordionTrigger className="rounded-lg px-2 py-3 text-left text-sm font-semibold tracking-tight text-white/90 transition-colors hover:bg-white/[0.04] hover:no-underline sm:text-[15px]">
                <span className="mr-3 inline-flex items-center gap-2">
                  <Icon className={cn("h-4 w-4 shrink-0", item.iconClassName)} />
                  <span>{item.title}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-4 text-[13px] text-white/70">{item.content}</AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {!filteredItems.length && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/55">
          Ничего не найдено. Попробуйте изменить запрос.
        </div>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-white/35">
        Требования стриминговых сервисов иногда меняются. Если кейс нестандартный (сборник, кавер,
        сложное оформление прав) — уточните у поддержки OMF до финальной отправки.
      </p>
    </div>
  );
}
