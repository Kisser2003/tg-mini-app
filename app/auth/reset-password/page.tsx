"use client";

import { useState, Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { AuthMessage, AuthShell } from "@/components/AuthShell";
import { useRouter } from "next/navigation";
import { mapAuthErrorMessage } from "@/lib/auth-errors";
import { hapticMap } from "@/lib/haptic-map";
import { createSupabaseBrowser } from "@/lib/supabase";

function ResetPasswordContent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createSupabaseBrowser();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`
      });

      if (resetError) throw resetError;

      hapticMap.notificationSuccess();
      setSuccess(true);
    } catch (err: any) {
      console.error("Reset password error:", err);
      hapticMap.notificationError();
      setError(mapAuthErrorMessage(err, "Не получилось отправить письмо. Проверь почту и попробуй ещё раз."));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell
        title="Письмо отправлено"
        subtitle={`Мы отправили ссылку для нового пароля на ${email}. Открой письмо на этом устройстве.`}
      >
        <button type="button" onClick={() => router.push("/login")} className="omf-btn-secondary h-14 w-full text-[16px]">
          Вернуться ко входу
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Новый пароль"
      subtitle="Укажи почту аккаунта, и мы пришлём ссылку для сброса пароля."
      footer={
        <button
          type="button"
          onClick={() => router.back()}
          className="omf-focus inline-flex items-center gap-1.5 rounded-full py-1 text-omf-graphite transition-colors hover:text-omf-ink"
        >
          <ArrowLeft size={16} aria-hidden />
          Назад
        </button>
      }
    >
      <form onSubmit={handleResetPassword} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-2 block text-[13px] text-omf-graphite">
            Почта
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            autoComplete="email"
            placeholder="name@mail.com"
            className="min-h-[52px] w-full rounded-control border border-omf-line bg-omf-surface px-4 py-3 text-[16px] text-omf-ink outline-none transition-colors placeholder:text-omf-faint focus:border-omf-ultra disabled:opacity-50"
          />
        </div>

        {error && <AuthMessage kind="error">{error}</AuthMessage>}

        <button type="submit" disabled={loading} className="omf-btn-primary h-14 w-full text-[16px]">
          {loading ? "Отправляем…" : "Отправить ссылку"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-app items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-omf-line border-t-omf-ultra" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
