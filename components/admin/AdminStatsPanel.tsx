"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ADMIN_REJECT_PRESETS } from "@/components/AdminRejectModal";
import { cn } from "@/lib/utils";
import type { AdminStatsResponse } from "@/types/admin";

const FUNNEL_LABELS: Record<string, string> = {
  metadata: "Паспорт",
  assets: "Обложка",
  tracks: "Треки",
  review: "Проверка",
  submitted: "Отправили"
};

/** Статистика модерации: в свёрнутой строке — главное, по нажатию — всё. */
export function AdminStatsPanel({ stats }: { stats: AdminStatsResponse }) {
  const [open, setOpen] = useState(false);
  const decided = stats.ready_30d + stats.failed_30d;
  const rejectShare = decided > 0 ? `${Math.round((stats.failed_30d / decided) * 100)}%` : "—";
  const oldest = stats.oldest_wait_hours == null ? "—" : `${stats.oldest_wait_hours} ч`;
  const showFunnel = stats.funnel_30d.some((f) => f.users > 0);

  return (
    <section className="mt-10 border-t border-omf-line" aria-labelledby="admin-stats-toggle">
      <button
        type="button"
        id="admin-stats-toggle"
        aria-expanded={open}
        aria-controls="admin-stats-body"
        onClick={() => setOpen((v) => !v)}
        className="omf-focus flex w-full items-center justify-between gap-3 py-3.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-bold tracking-tight">Статистика</span>
          <span className="mt-0.5 block truncate text-[13px] text-omf-graphite">
            Сегодня одобрено {stats.ready_today} · отказы {rejectShare}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-omf-graphite transition-transform motion-reduce:transition-none",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div id="admin-stats-body" className="pb-2">
          <dl className="grid grid-cols-3 gap-3 border-y border-omf-line py-4 text-center">
            <div>
              <dt className="text-[12px] text-omf-graphite">Ждёт дольше всех</dt>
              <dd
                className={cn(
                  "mt-1 text-[22px] font-extrabold tabular-nums",
                  (stats.oldest_wait_hours ?? 0) >= 24 ? "text-omf-red" : "text-omf-ink"
                )}
              >
                {oldest}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-omf-graphite">Одобрено за сегодня</dt>
              <dd className="mt-1 text-[22px] font-extrabold tabular-nums">{stats.ready_today}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-omf-graphite">Отказы, 30 дней</dt>
              <dd className="mt-1 text-[22px] font-extrabold tabular-nums">{rejectShare}</dd>
            </div>
            {stats.top_reject_reasons.length > 0 ? (
              <p className="col-span-3 text-left text-[13px] text-omf-graphite">
                Частые причины:{" "}
                {stats.top_reject_reasons
                  .map((r) => {
                    const label = ADMIN_REJECT_PRESETS.find((p) => p.key === r.key)?.label ?? "Своя причина";
                    return `${label} (${r.count})`;
                  })
                  .join(", ")}
              </p>
            ) : null}
          </dl>

          {showFunnel ? (
            <section className="mt-5" aria-label="Воронка создания релиза">
              <h3 className="text-[13px] text-omf-graphite">Воронка, 30 дней (уникальные пользователи)</h3>
              <ol className="mt-1">
                {stats.funnel_30d.map((f, i) => {
                  const prev = i > 0 ? stats.funnel_30d[i - 1].users : 0;
                  return (
                    <li
                      key={f.step}
                      className="flex items-baseline justify-between border-b border-omf-line py-2 text-[14px]"
                    >
                      <span>{FUNNEL_LABELS[f.step] ?? f.step}</span>
                      <span className="tabular-nums">
                        {f.users}
                        {i > 0 && prev > 0 ? (
                          <span className="ml-2 text-omf-faint">{Math.round((f.users / prev) * 100)}%</span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
