"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { hapticMap } from "@/lib/haptic-map";
import { getTelegramApiAuthHeaders } from "@/lib/telegram";

export function FeedbackCard() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);

  const canSubmit = message.trim().length >= 3 && !sending;

  const submitFeedback = async () => {
    const text = message.trim();
    if (text.length < 3 || sending) return;
    setSending(true);
    setStatusText(null);
    setStatusError(false);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getTelegramApiAuthHeaders()
        },
        body: JSON.stringify({
          message: text,
          route: typeof window !== "undefined" ? window.location.pathname : "/requirements",
          userAgent: typeof window !== "undefined" ? navigator.userAgent : undefined
        })
      });

      const json = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || json?.ok !== true) {
        throw new Error(json?.error || "Не удалось отправить сообщение.");
      }

      hapticMap.notificationSuccess();
      setMessage("");
      setStatusText("Спасибо! Сообщение отправлено.");
      setStatusError(false);
    } catch (error) {
      hapticMap.notificationError();
      setStatusText(error instanceof Error ? error.message : "Ошибка отправки.");
      setStatusError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-md">
      <h2 className="text-sm font-semibold text-white/90">Есть идея или проблема?</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-white/45">
        Напишите, что улучшить в приложении. Сообщение сразу попадет в админ-панель данных.
      </p>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Например: добавьте фильтр по датам в библиотеке..."
        maxLength={4000}
        className="mt-3 min-h-[110px] w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-indigo-400/50"
      />

      <div className="mt-2 flex items-center justify-between text-[11px] text-white/35">
        <span>Минимум 3 символа</span>
        <span>{message.length}/4000</span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submitFeedback}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/90 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
          {sending ? "Отправка..." : "Отправить"}
        </button>
        {statusText ? (
          <p className={`text-[12px] ${statusError ? "text-red-300" : "text-emerald-300"}`}>{statusText}</p>
        ) : null}
      </div>
    </section>
  );
}
