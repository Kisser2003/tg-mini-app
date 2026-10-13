"use client";

import { useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { ReleaseSleeve } from "@/components/ReleaseSleeve";
import { hapticMap } from "@/lib/haptic-map";
import { openTelegramChat } from "@/lib/open-smart-link";
import { formatAgoRu } from "@/lib/admin-release-metadata";
import type { AdminStuckRelease } from "@/types/admin";

const COLLAPSED_COUNT = 3;

/** «Застряли до отправки»: начали релиз, но не нажали «Отправить». Показываем первые три. */
export function AdminStuckList({ stuck }: { stuck: AdminStuckRelease[] }) {
  const [expanded, setExpanded] = useState(false);
  if (stuck.length === 0) return null;
  const visible = expanded ? stuck : stuck.slice(0, COLLAPSED_COUNT);

  return (
    <section className="mt-10" aria-labelledby="admin-stuck">
      <h2 id="admin-stuck" className="text-[15px] font-bold tracking-tight">
        Застряли до отправки: {stuck.length}
      </h2>
      <p className="mt-0.5 text-[13px] text-omf-faint">
        Начали релиз, но не нажали «Отправить». В очередь не попадут, пока артист не закончит.
      </p>
      <ul className="mt-1">
        {visible.map((s) => (
          <li key={s.id} className="flex items-center gap-3 border-b border-omf-line py-3">
            <Link
              href={`/admin/release/${s.id}`}
              className="omf-focus flex min-w-0 flex-1 items-center gap-3 rounded-[10px]"
            >
              <div className="w-12 shrink-0">
                <ReleaseSleeve seed={s.id} title={s.title} artist={s.artist_name} coverUrl={s.artwork_url} size="thumb" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold leading-tight tracking-[-0.01em]">{s.title}</p>
                <p className="mt-0.5 truncate text-[13px] text-omf-graphite">
                  {s.artist_name}
                  {s.telegram_username ? ` · @${s.telegram_username}` : ""}
                </p>
                <p className="mt-0.5 text-[12px] text-omf-faint">
                  {s.status === "pending" ? "Файлы загружены" : "Черновик"} · треков: {s.tracks_count} ·{" "}
                  {formatAgoRu(s.created_at)}
                </p>
              </div>
            </Link>
            {s.telegram_username ? (
              <button
                type="button"
                onClick={() => {
                  hapticMap.impactLight();
                  openTelegramChat(s.telegram_username!);
                }}
                aria-label={`Написать @${s.telegram_username}`}
                className="omf-focus flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-omf-ultra-text transition-colors hover:bg-omf-surface hover:text-omf-ink"
              >
                <Send className="h-[18px] w-[18px]" aria-hidden />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {stuck.length > COLLAPSED_COUNT ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="omf-focus mt-2 rounded-full py-1.5 text-[14px] text-omf-ultra-text hover:text-omf-ink"
        >
          {expanded ? "Свернуть" : `Показать все (${stuck.length})`}
        </button>
      ) : null}
    </section>
  );
}
