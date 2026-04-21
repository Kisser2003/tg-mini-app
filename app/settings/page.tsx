"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Bell, LogOut, MoonStar, ShieldCheck } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { getTelegramApiAuthHeaders } from "@/lib/telegram";
import { toast } from "sonner";
import { useLogout, useWebAuth } from "@/lib/hooks/useWebAuth";
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
  icon: Icon,
  checked,
  onChange,
  disabled
}: {
  label: string;
  icon: React.ElementType;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex w-full cursor-pointer items-center justify-between gap-4 p-4">
      <span className="inline-flex items-center gap-3">
        <Icon className="h-4 w-4 text-white/80" />
        <span className="text-sm">{label}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          checked
            ? "border-primary/60 bg-primary"
            : "border-white/20 bg-white/10"
        } disabled:opacity-50`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const {
    data: prefs,
    isLoading,
    mutate
  } = useSWR("settings-preferences", fetchPreferences, {
    revalidateOnFocus: false
  });

  const [isSavingPush, setIsSavingPush] = useState(false);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleTogglePush = useCallback(
    async (value: boolean) => {
      setIsSavingPush(true);
      try {
        const updated = await savePreferences({ push_notifications: value });
        await mutate(updated, { revalidate: false });
        toast.success(
          value ? "Push-уведомления включены" : "Push-уведомления отключены"
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
      } finally {
        setIsSavingPush(false);
      }
    },
    [mutate]
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 pb-28 px-5 py-6">
      <GlassCard className="p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-white/55">Настройки</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Параметры приложения</h1>
      </GlassCard>

      {/* Appearance — static (dark-only app) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0, type: "spring", stiffness: 320, damping: 22 }}
        className="glass-card p-4"
      >
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-3">
            <MoonStar className="h-4 w-4 text-white/80" />
            <span className="text-sm">Темный интерфейс</span>
          </span>
          <span className="text-xs text-white/60">Включен (только тёмный)</span>
        </div>
      </motion.div>

      {/* Push notifications */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, type: "spring", stiffness: 320, damping: 22 }}
        className="glass-card overflow-hidden"
      >
        {isLoading ? (
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-white/80" />
              <div className="h-3 w-40 animate-pulse rounded bg-white/10" />
            </div>
            <div className="h-6 w-11 animate-pulse rounded-full bg-white/10" />
          </div>
        ) : (
          <ToggleRow
            label="Push-уведомления"
            icon={Bell}
            checked={prefs?.push_notifications ?? true}
            onChange={handleTogglePush}
            disabled={isSavingPush}
          />
        )}
      </motion.div>

      {/* Security — static info */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 320, damping: 22 }}
        className="glass-card flex items-center justify-between p-4"
      >
        <span className="inline-flex items-center gap-3">
          <ShieldCheck className="h-4 w-4 text-white/80" />
          <span className="text-sm">Безопасность дистрибуции</span>
        </span>
        <span className="text-xs text-white/60">Защищено</span>
      </motion.div>

      {/* Logout button for web users */}
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
      toast.error("Ошибка выхода");
      setIsLoggingOut(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, type: "spring", stiffness: 320, damping: 22 }}
    >
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="glass-card w-full flex items-center justify-center gap-2 p-4 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" />
        {isLoggingOut ? "Выход..." : "Выйти из аккаунта"}
      </button>
    </motion.div>
  );
}
