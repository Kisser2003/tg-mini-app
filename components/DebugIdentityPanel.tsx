"use client";

import { useEffect, useState } from "react";
import { getMyReleases } from "@/repositories/releases.repo";
import { getTelegramUserIdForSupabaseRequests, getTelegramUserId } from "@/lib/telegram";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";

function showDebugStrip(): boolean {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEBUG_IDENTITY === "false") {
    return false;
  }
  return true;
}

/**
 * Мини-плашка: эффективный id для Supabase (RLS), Telegram WebApp id, id в сторе черновика,
 * пример telegram_id из первой строки релизов (если список загрузился).
 */
export function DebugIdentityPanel() {
  const storeUserId = useCreateReleaseDraftStore((s) => s.userId);
  const [sampleTelegramId, setSampleTelegramId] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const rlsId = getTelegramUserIdForSupabaseRequests();
  const tgWebId = getTelegramUserId();

  useEffect(() => {
    if (!showDebugStrip()) return;
    const uid = rlsId != null ? String(rlsId) : null;
    if (uid == null) {
      setSampleTelegramId(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = await getMyReleases(uid);
        if (cancelled) return;
        const first = rows[0];
        const tid = first?.telegram_id;
        setSampleTelegramId(
          tid != null && tid !== undefined ? String(tid) : first ? "(null в строке)" : "—"
        );
        setLoadErr(null);
        // eslint-disable-next-line no-console
        console.log("[DebugIdentity]", {
          rlsUserId: rlsId,
          telegramWebAppUserId: tgWebId,
          storeUserId,
          sampleReleaseTelegramId: tid,
          filterUserIdForList: uid
        });
      } catch (e: unknown) {
        if (cancelled) return;
        setLoadErr(e instanceof Error ? e.message : "list error");
        setSampleTelegramId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rlsId, tgWebId, storeUserId]);

  if (!showDebugStrip()) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] w-[min(100%,420px)] -translate-x-1/2 px-2"
      aria-hidden
    >
      <div className="rounded-lg border border-white/10 bg-black/75 px-2 py-1.5 font-mono text-[9px] leading-snug text-white/70 shadow-lg backdrop-blur-md">
        <div className="text-white/45">Supabase (anon + x-telegram-user-id, без Auth user)</div>
        <div>
          <span className="text-emerald-400/90">rls/effective id:</span> {rlsId ?? "—"}
        </div>
        <div>
          <span className="text-sky-400/90">Telegram WebApp id:</span> {tgWebId ?? "—"}
        </div>
        <div>
          <span className="text-violet-400/90">store userId:</span> {storeUserId ?? "—"}
        </div>
        <div>
          <span className="text-amber-400/90">releases[0].telegram_id:</span>{" "}
          {sampleTelegramId ?? (loadErr ? `err: ${loadErr}` : "…")}
        </div>
      </div>
    </div>
  );
}
