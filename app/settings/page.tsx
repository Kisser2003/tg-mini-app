"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Bell, CreditCard, MoonStar, Save, ShieldCheck } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { getTelegramApiAuthHeaders } from "@/lib/telegram";
import { toast } from "sonner";
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

// ─── Payout method labels ────────────────────────────────────────────────────

const PAYOUT_METHODS = [
  { value: "bank_card", label: "Банковская карта" },
  { value: "crypto", label: "Криптовалюта" },
  { value: "paypal", label: "PayPal" }
] as const;

type PayoutMethod = (typeof PAYOUT_METHODS)[number]["value"] | null;

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
  const [isSavingPayout, setIsSavingPayout] = useState(false);

  // Local payout form state
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>(null);
  const [payoutDetails, setPayoutDetails] = useState("");
  const [payoutFormDirty, setPayoutFormDirty] = useState(false);

  // Sync local state when remote prefs load
  const syncLocal = useCallback((p: UserPreferences) => {
    setPayoutMethod((p.payout_method as PayoutMethod) ?? null);
    setPayoutDetails(
      p.payout_details ? JSON.stringify(p.payout_details, null, 2) : ""
    );
    setPayoutFormDirty(false);
  }, []);

  // Run once when data arrives
  const prevPrefsRef = useState<string>("");
  if (prefs) {
    const key = prefs.updated_at;
    if (prevPrefsRef[0] !== key) {
      prevPrefsRef[1](key);
      syncLocal(prefs);
    }
  }

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

  const handleSavePayout = useCallback(async () => {
    let parsedDetails: Record<string, unknown> | null = null;
    if (payoutDetails.trim()) {
      try {
        parsedDetails = JSON.parse(payoutDetails) as Record<string, unknown>;
      } catch {
        toast.error("Детали реквизитов должны быть в формате JSON.");
        return;
      }
    }
    setIsSavingPayout(true);
    try {
      const updated = await savePreferences({
        payout_method: payoutMethod,
        payout_details: parsedDetails
      });
      await mutate(updated, { revalidate: false });
      setPayoutFormDirty(false);
      toast.success("Реквизиты сохранены");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setIsSavingPayout(false);
    }
  }, [payoutMethod, payoutDetails, mutate]);

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

      {/* Payout details */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 320, damping: 22 }}
        className="glass-card p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-white/80" />
          <span className="text-sm font-medium">Реквизиты вывода</span>
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
            Способ вывода
          </label>
          <select
            value={payoutMethod ?? ""}
            onChange={(e) => {
              setPayoutMethod((e.target.value as PayoutMethod) || null);
              setPayoutFormDirty(true);
            }}
            disabled={isLoading || isSavingPayout}
            className="w-full rounded-[14px] border border-white/[0.08] bg-black/30 px-4 py-3 text-[15px] text-white outline-none transition focus:bg-black/45 focus:ring-2 focus:ring-violet-500/25 disabled:opacity-50 [color-scheme:dark]"
          >
            <option value="">— Не выбрано —</option>
            {PAYOUT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {payoutMethod && (
          <div className="space-y-2">
            <label className="block text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
              Детали (JSON)
            </label>
            <textarea
              value={payoutDetails}
              onChange={(e) => {
                setPayoutDetails(e.target.value);
                setPayoutFormDirty(true);
              }}
              disabled={isLoading || isSavingPayout}
              rows={4}
              placeholder={
                payoutMethod === "bank_card"
                  ? '{"card_number": "4111 **** **** 1234", "holder": "Ivan Petrov"}'
                  : payoutMethod === "crypto"
                    ? '{"address": "0x...", "network": "ETH"}'
                    : '{"email": "user@example.com"}'
              }
              className="w-full resize-none rounded-[14px] border border-white/[0.08] bg-black/30 px-4 py-3 font-mono text-[13px] text-white/90 outline-none transition placeholder:text-white/25 focus:bg-black/45 focus:ring-2 focus:ring-violet-500/25 disabled:opacity-50"
            />
            <p className="text-[11px] text-white/35">
              Вводите реквизиты в формате JSON. Данные шифруются при хранении.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSavePayout}
          disabled={!payoutFormDirty || isSavingPayout || isLoading}
          className="inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-[16px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-[14px] font-semibold text-white shadow-[0_10px_28px_rgba(88,80,236,0.5)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <Save className="h-4 w-4" />
          {isSavingPayout ? "Сохраняем…" : "Сохранить реквизиты"}
        </button>
      </motion.div>

      {/* Security — static info */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 320, damping: 22 }}
        className="glass-card flex items-center justify-between p-4"
      >
        <span className="inline-flex items-center gap-3">
          <ShieldCheck className="h-4 w-4 text-white/80" />
          <span className="text-sm">Безопасность дистрибуции</span>
        </span>
        <span className="text-xs text-white/60">Защищено</span>
      </motion.div>
    </div>
  );
}
