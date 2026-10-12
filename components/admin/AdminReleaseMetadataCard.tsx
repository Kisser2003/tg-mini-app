"use client";

import { useMemo, useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  buildReleaseMetadataSections,
  type AdminReleaseRow
} from "@/lib/admin-release-metadata";
import { cn } from "@/lib/utils";
import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases/types";

function CopyValueButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      toast.success("Скопировано");
      window.setTimeout(() => setDone(false), 1600);
    } catch {
      toast.error("Не удалось скопировать");
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className="omf-focus inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-omf-graphite hover:text-omf-ink"
      title="Копировать"
      aria-label="Копировать значение"
    >
      {done ? <Check className="h-4 w-4 text-omf-green" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

export function AdminReleaseMetadataCard({
  release,
  tracks
}: {
  release: ReleaseRecord;
  tracks: ReleaseTrackRow[];
}) {
  const sections = useMemo(
    () => buildReleaseMetadataSections(release as AdminReleaseRow, tracks),
    [release, tracks]
  );

  if (sections.length === 0) {
    return (
      <p className="text-[14px] text-omf-graphite">Данных для показа нет.</p>
    );
  }

  return (
    <div className="space-y-7">
      {sections.map((section) => (
        <section key={section.title}>
          <h3 className="text-[15px] font-bold tracking-tight text-omf-ink">{section.title}</h3>
          <dl className="mt-1">
            {section.entries.map((entry, idx) => (
              <div
                key={`${section.title}-${idx}-${entry.label}`}
                className="border-b border-omf-line py-3"
              >
                <dt className="text-[13px] text-omf-graphite">{entry.label}</dt>
                <dd className="mt-1 flex items-start gap-2">
                  <pre
                    className={cn(
                      "min-w-0 flex-1 overflow-auto whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed text-omf-ink",
                      entry.label === "Текст песни" ? "max-h-[min(28rem,70vh)]" : "max-h-64"
                    )}
                  >
                    {entry.value}
                  </pre>
                  <CopyValueButton value={entry.value} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
