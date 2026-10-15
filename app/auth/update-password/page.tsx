"use client";

import { useState, Suspense } from "react";
import { AuthMessage, AuthShell } from "@/components/AuthShell";
import { useRouter } from "next/navigation";
import { mapAuthErrorMessage } from "@/lib/auth-errors";
import { hapticMap } from "@/lib/haptic-map";
import { createSupabaseBrowser } from "@/lib/supabase";
import { AppOrb } from "@/components/AppOrb";

function UpdatePasswordContent() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      hapticMap.notificationError();
      setError("Пароли не совпадают. Введи один и тот же пароль дважды.");
      return;
    }

    if (password.length < 6) {
      hapticMap.notificationError();
      setError("Пароль должен быть не короче 6 символов.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createSupabaseBrowser();

      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      hapticMap.notificationSuccess();
      setSuccess(true);

      // Редирект через 2 секунды
      setTimeout(() => {
        router.push("/library");
      }, 2000);
    } catch (err: any) {
      console.error("Update password error:", err);
      hapticMap.notificationError();
      setError(mapAuthErrorMessage(err, "Не получилось сохранить пароль. Запроси новую ссылку и попробуй снова."));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return <AuthShell title="Пароль обновлён" subtitle="Открываем приложение…">{null}</AuthShell>;
  }

  return (
    <AuthShell title="Новый пароль" subtitle="Придумай пароль не короче 6 символов.">
      <form onSubmit={handleUpdatePassword} className="space-y-5">
        <div>
          <label htmlFor="password" className="mb-2 block text-[13px] text-omf-graphite">
            Пароль
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            autoComplete="new-password"
            minLength={6}
            className="min-h-[52px] w-full rounded-control border border-omf-line bg-omf-surface px-4 py-3 text-[16px] text-omf-ink outline-none transition-colors placeholder:text-omf-faint focus:border-omf-ultra disabled:opacity-50"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-2 block text-[13px] text-omf-graphite">
            Повтори пароль
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
            autoComplete="new-password"
            minLength={6}
            className="min-h-[52px] w-full rounded-control border border-omf-line bg-omf-surface px-4 py-3 text-[16px] text-omf-ink outline-none transition-colors placeholder:text-omf-faint focus:border-omf-ultra disabled:opacity-50"
          />
        </div>

        {error && <AuthMessage kind="error">{error}</AuthMessage>}

        <button type="submit" disabled={loading} className="omf-btn-primary h-14 w-full text-[16px]">
          {loading ? (
            <>
              <AppOrb state="working" size={20} />
              Сохраняем…
            </>
          ) : (
            "Сохранить пароль"
          )}
        </button>
      </form>
    </AuthShell>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-app items-center justify-center">
          <AppOrb state="connecting" label="Загружаем" />
        </div>
      }
    >
      <UpdatePasswordContent />
    </Suspense>
  );
}
