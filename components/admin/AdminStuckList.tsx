"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Send } from "lucide-react";
import { toast } from "sonner";
import { remindArtist } from "@/features/admin/actions";
import { ReleaseSleeve } from "@/components/ReleaseSleeve";
import { hapticMap } from "@/lib/haptic-map";
import { openTelegramChat } from "@/lib/open-smart-link";
import { formatAgoRu } from "@/lib/admin-release-metadata";
import type { AdminStuckRelease } from "@/types/admin";

const COLLAPSED_COUNT = 3;

/** «Застряли до отправки»: начали релиз, но не нажали «Отправить». Показываем первые три. */
export function AdminStuckList({ stuck }: { stuck: AdminStuckRelease[] }) {
  const [expanded, setExpanded] = useState(false);
  /** Кому уже напомнили в этой сессии (сервер дополнительно ограничивает раз в сутки). */
  const [reminded, setReminded] = useState<Record<string, true>>({});
  const [remindingId, setRemindingId] = useState<string | null>(null);
  if (stuck.length === 0) return null;

  const onRemind = async (id: string) => {
    hapticMap.impactLight();
    setRemindingId(id);
    try {
      await remindArtist(id);
      setReminded((prev) => ({ ...prev, [id]: true }));
      hapticMap.notificationSuccess();
      toast.success("Напомнили артисту в боте");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Не удалось отправить напоминание.";
      if (msg.includes("Уже напоминали")) setReminded((prev) => ({ ...prev, [id]: true }));
      toast.error(msg);
    } finally {
      setRemindingId(null);
    }
  };
  const visible = expanded ? stuck : stuck.slice(0, COLLAPSED_COUNT);

  return (
    <section className="mt-10" aria-labelledby="admin-stuck">
      <h2 id="admin-stuck" className="text-[15px] font-bold tracking-tight">
        Застряли до отправки: {stuck.length}
      </h2>
      <p className="mt-0.5 text-[13px] text-omf-faint">
        Начали релиз, но не нажали «Отправить». В очередь не попадут, пока артист не закончит.
        Колокольчик — напомнить в боте.
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
            {s.can_remind ? (
              <button
                type="button"
                onClick={() => void onRemind(s.id)}
                disabled={remindingId != null || reminded[s.id] === true}
                aria-label={reminded[s.id] ? "Уже напомнили" : `Напомнить в боте: ${s.title}`}
                title={reminded[s.id] ? "Уже напомнили" : "Напомнить в боте"}
                className="omf-focus flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-omf-ultra-text transition-colors hover:bg-omf-surface hover:text-omf-ink disabled:text-omf-faint disabled:hover:bg-transparent"
              >
                {reminded[s.id] ? (
                  <BellRing className="h-[18px] w-[18px]" aria-hidden />
                ) : (
                  <Bell className={remindingId === s.id ? "h-[18px] w-[18px] animate-pulse" : "h-[18px] w-[18px]"} aria-hidden />
                )}
              </button>
            ) : null}
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
