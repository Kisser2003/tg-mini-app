"use client";

import { useMemo, useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  buildReleaseMetadataSections,
  type AdminReleaseRow
} from "@/lib/admin-release-metadata";
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
      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
      title="Копировать"
      aria-label="Копировать значение"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
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
      <p className="text-sm text-white/50">Нет метаданных для отображения.</p>
    );
  }

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.title}>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            {section.title}
          </h3>
          <dl className="space-y-3">
            {section.entries.map((entry, idx) => (
              <div
                key={`${section.title}-${idx}-${entry.label}`}
                className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5"
              >
                <dt className="text-[11px] font-medium uppercase tracking-wide text-white/40">
                  {entry.label}
                </dt>
                <dd className="mt-1.5 flex gap-2">
                  <pre className="max-h-64 min-w-0 flex-1 overflow-auto whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-white/90">
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
