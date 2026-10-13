"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { getTelegramApiAuthHeaders } from "@/lib/telegram";
import { toast } from "sonner";
import { useIsTelegramMiniApp } from "@/lib/hooks/useIsTelegramMiniApp";
import { useLogout, useWebAuth } from "@/lib/hooks/useWebAuth";
import { useBackNavigation } from "@/lib/hooks/useTelegramBackButton";
import { hapticMap } from "@/lib/haptic-map";
import type { UserPreferences } from "@/app/api/settings/preferences/route";

// ─── Fetcher ──────────────────────────────────────────────────────────────────

async function fetchPreferences(): Promise<UserPreferences> {
  const res = await fetch("/api/settings/preferences", {
    headers: getTelegramApiAuthHeaders()
  });
  const json: unknown = await res.json();
  if (!res.ok || typeof json !== "object" || json === null || !("preferences" in json)) {
    throw new Error("Не удалось загрузить настройки.");
  }
  return (json as { preferences: UserPreferences }).preferences;
}

async function savePreferences(
  patch: Partial<Omit<UserPreferences, "user_id" | "updated_at">>
): Promise<UserPreferences> {
  const res = await fetch("/api/settings/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getTelegramApiAuthHeaders()
    },
    body: JSON.stringify(patch)
  });
  const json: unknown = await res.json();
  if (!res.ok || typeof json !== "object" || json === null || !("preferences" in json)) {
    throw new Error("Не удалось сохранить настройки.");
  }
  return (json as { preferences: UserPreferences }).preferences;
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-4 border-b border-omf-line py-4">
      <div className="min-w-0">
        <p className="text-[16px] text-omf-ink">{label}</p>
        {hint ? <p className="mt-0.5 text-[14px] text-omf-graphite">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => {
          hapticMap.selection();
          onChange(!checked);
        }}
        className={`omf-focus omf-press relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full disabled:cursor-wait ${
          checked ? "bg-omf-ultra" : "bg-omf-line-strong"
        }`}
      >
        <span
          className={`inline-block h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] ${
            checked ? "translate-x-[25px]" : "translate-x-[3px]"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  useBackNavigation("/requirements");
  const isTelegramContext = useIsTelegramMiniApp();
  const {
    data: prefs,
    isLoading,
    mutate
  } = useSWR(isTelegramContext ? "settings-preferences" : null, fetchPreferences, {
    revalidateOnFocus: false
  });

  const [isSavingPush, setIsSavingPush] = useState(false);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  /**
   * Переключатель двигается сразу (оптимистично), сервер догоняет. Раньше бегунок стоял
   * на месте до ответа API — тап ощущался как «не сработал». При ошибке откатываем.
   */
  const handleTogglePush = useCallback(
    async (value: boolean) => {
      const previous = prefs;
      setIsSavingPush(true);
      if (previous) {
        void mutate({ ...previous, push_notifications: value }, { revalidate: false });
      }
      try {
        const updated = await savePreferences({ push_notifications: value });
        await mutate(updated, { revalidate: false });
        toast.success(value ? "Уведомления включены" : "Уведомления выключены");
      } catch (e) {
        hapticMap.notificationError();
        if (previous) void mutate(previous, { revalidate: false });
        toast.error(e instanceof Error ? e.message : "Не удалось сохранить. Попробуй ещё раз.");
      } finally {
        setIsSavingPush(false);
      }
    },
    [mutate, prefs]
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-lg px-1 pb-40 pt-6 text-omf-ink">
      <h1 className="text-[40px] font-extrabold leading-[0.92] tracking-[-0.045em]">Настройки</h1>

      <div className="mt-6">
        {!isTelegramContext ? (
          <div className="border-b border-omf-line py-4">
            <p className="text-[16px] text-omf-ink">Уведомления</p>
            <p className="mt-0.5 text-[14px] text-omf-graphite">
              В веб-версии решения модератора отмечены меткой «Новое» в списке релизов. Сообщения в
              Telegram приходят, если открыть приложение из бота.
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-between border-b border-omf-line py-4" aria-busy="true">
            <div className="h-4 w-40 animate-pulse rounded bg-omf-surface" />
            <div className="h-8 w-[52px] animate-pulse rounded-full bg-omf-surface" />
          </div>
        ) : (
          <ToggleRow
            label="Уведомления"
            hint="Сообщения в Telegram, когда модератор принял решение по релизу."
            checked={prefs?.push_notifications ?? true}
            onChange={handleTogglePush}
            disabled={isSavingPush}
          />
        )}
        <div className="border-b border-omf-line py-4">
          <p className="text-[16px] text-omf-ink">Оформление</p>
          <p className="mt-0.5 text-[14px] text-omf-graphite">Приложение всегда тёмное.</p>
        </div>
      </div>

      <WebLogoutButton />
    </div>
  );
}

function WebLogoutButton() {
  const webUser = useWebAuth();
  const { logout } = useLogout();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Показываем только для веб-пользователей (не в Telegram)
  if (typeof window === "undefined") return null;
  if (window.Telegram?.WebApp?.initData) return null;
  if (!webUser) return null;

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
      toast.error("Не получилось выйти. Попробуй ещё раз.");
      setIsLoggingOut(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="omf-btn-secondary mt-8 w-full text-omf-red disabled:opacity-50"
    >
      {isLoggingOut ? "Выходим…" : "Выйти из аккаунта"}
    </button>
  );
}
