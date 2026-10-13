"use client";

import { useState } from "react";
import Link from "next/link";
import { ReleaseSleeve } from "@/components/ReleaseSleeve";
import { hapticMap } from "@/lib/haptic-map";
import { formatAgoRu } from "@/lib/admin-release-metadata";
import { DSP_REVIEW_DAYS_TEXT } from "@/lib/release-next-step";
import type { AdminAwaitingLinkRelease } from "@/types/admin";

const COLLAPSED_COUNT = 5;

/** Принятые релизы без ссылки на пресейв: дольше всех ждущие сверху. */
export function AdminAwaitingLinkList({
  rows,
  onAddLink
}: {
  rows: AdminAwaitingLinkRelease[];
  onAddLink: (releaseId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return null;
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_COUNT);

  return (
    <section className="mt-10" aria-labelledby="admin-awaiting-link">
      <h2 id="admin-awaiting-link" className="text-[15px] font-bold tracking-tight">
        Ждут ссылку: {rows.length}
      </h2>
      <p className="mt-0.5 text-[13px] text-omf-faint">
        Приняты и ушли на площадки (обычно {DSP_REVIEW_DAYS_TEXT}). Когда будет UPC, сделай BandLink и добавь ссылку.
      </p>
      <ul className="mt-1">
        {visible.map((r) => (
          <li key={r.id} className="flex items-center gap-3 border-b border-omf-line py-3">
            <Link
              href={`/admin/release/${r.id}`}
              className="omf-focus flex min-w-0 flex-1 items-center gap-3 rounded-[10px]"
            >
              <div className="w-12 shrink-0">
                <ReleaseSleeve seed={r.id} title={r.title} artist={r.artist_name} coverUrl={r.artwork_url} size="thumb" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold leading-tight tracking-[-0.01em]">{r.title}</p>
                <p className="mt-0.5 truncate text-[13px] text-omf-graphite">{r.artist_name}</p>
                <p className="mt-0.5 text-[12px] text-omf-faint">
                  принят {formatAgoRu(r.accepted_at)}
                  {r.upc ? ` · UPC ${r.upc}` : ""}
                </p>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => {
                hapticMap.impactLight();
                onAddLink(r.id);
              }}
              className="omf-btn-secondary h-10 shrink-0 px-4 text-[14px]"
            >
              Ссылка
            </button>
          </li>
        ))}
      </ul>
      {rows.length > COLLAPSED_COUNT ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="omf-focus mt-2 rounded-full py-1.5 text-[14px] text-omf-ultra-text hover:text-omf-ink"
        >
          {expanded ? "Свернуть" : `Показать все (${rows.length})`}
        </button>
      ) : null}
    </section>
  );
}
