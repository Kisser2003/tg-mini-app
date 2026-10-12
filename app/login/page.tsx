"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthMessage, AuthShell } from "@/components/AuthShell";
import { createSupabaseBrowser } from "@/lib/supabase";
import { appendCurrentTelegramHash, isTelegramClientShell } from "@/lib/telegram";
import { useIsTelegramMiniApp } from "@/lib/hooks/useIsTelegramMiniApp";
import { mapAuthErrorMessage } from "@/lib/auth-errors";
import { hapticMap } from "@/lib/haptic-map";

type AuthMode = "login" | "signup";

/** Регистрация только при явном ?mode=signup (или после клика «Зарегистрируйтесь»). Чистый /login — всегда вход. */
function authModeFromSearchParams(searchParams: ReturnType<typeof useSearchParams>): AuthMode {
  return searchParams.get("mode")?.toLowerCase().trim() === "signup" ? "signup" : "login";
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = authModeFromSearchParams(searchParams);
  const redirectTo = searchParams.get("redirect") || "/library";
  const isTelegram = useIsTelegramMiniApp();

  /** В Mini App вход по email не нужен — уходим с формы, если попали сюда по ошибочному редиректу. */
  useEffect(() => {
    if (!isTelegram) return;
    const target = redirectTo.startsWith("/") ? redirectTo : "/library";
    router.replace(appendCurrentTelegramHash(target));
  }, [isTelegram, router, redirectTo]);
  /** Имя артиста / сценическое имя — только при регистрации */
  const [artistName, setArtistName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (authModeFromSearchParams(searchParams) === "login") {
      setArtistName("");
    }
  }, [searchParams]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const supabase = createSupabaseBrowser();

      if (mode === "signup") {
        const name = artistName.trim();
        if (name.length < 2) {
          hapticMap.notificationError();
          setError("Имя артиста должно быть не короче 2 символов.");
          setLoading(false);
          return;
        }
        if (name.length > 120) {
          hapticMap.notificationError();
          setError("Имя слишком длинное. Сократи его до 120 символов.");
          setLoading(false);
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm?redirect=${encodeURIComponent(redirectTo)}`,
            data: {
              display_name: name,
              full_name: name
            }
          }
        });

        if (signUpError) throw signUpError;

        if (data.user && data.session) {
          // Email confirmed automatically (для разработки)
          setSuccess("Аккаунт создан. Открываем приложение…");
          setTimeout(() => {
            const target = redirectTo.startsWith("/") ? redirectTo : "/library";
            if (isTelegramClientShell()) {
              window.location.assign(target);
              return;
            }
            router.refresh();
            router.push(target);
          }, 1500);
        } else if (data.user) {
          // Email требует подтверждения
          setSuccess("Мы отправили письмо на " + email + ". Открой его и подтверди почту, потом войди.");
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) throw signInError;

        if (data.session) {
          hapticMap.notificationSuccess();
          setSuccess("Готово. Открываем приложение…");
          setTimeout(() => {
            const target = redirectTo.startsWith("/") ? redirectTo : "/library";
            if (isTelegramClientShell()) {
              window.location.assign(target);
              return;
            }
            router.refresh();
            router.push(target);
          }, 800);
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      hapticMap.notificationError();
      setError(mapAuthErrorMessage(err, "Не получилось войти. Проверь почту и пароль и попробуй ещё раз."));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setError("");
    setSuccess("");
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "login") {
      params.set("mode", "signup");
    } else {
      params.delete("mode");
    }
    const qs = params.toString();
    router.replace(qs ? `/login?${qs}` : "/login", { scroll: false });
  };

  const FIELD =
    "min-h-[52px] w-full rounded-control border border-omf-line bg-omf-surface px-4 py-3 text-[16px] text-omf-ink outline-none transition-colors placeholder:text-omf-faint focus:border-omf-ultra disabled:opacity-50";
  const LABEL = "mb-2 block text-[13px] text-omf-graphite";

  return (
    <AuthShell
      title={mode === "login" ? "Вход" : "Новый аккаунт"}
      subtitle={
        mode === "login"
          ? "Войди, чтобы управлять своими релизами."
          : "Создай аккаунт, чтобы выпускать музыку на площадки."
      }
      footer={
        <>
          <button
            type="button"
            onClick={toggleMode}
            disabled={loading}
            className="omf-focus rounded-full py-1 text-omf-graphite transition-colors hover:text-omf-ink disabled:opacity-50"
          >
            {mode === "login" ? (
              <>
                Нет аккаунта? <span className="font-medium text-omf-ultra-text">Создать</span>
              </>
            ) : (
              <>
                Уже есть аккаунт? <span className="font-medium text-omf-ultra-text">Войти</span>
              </>
            )}
          </button>
          <p className="mt-4 text-[13px] text-omf-faint">
            В Telegram приложение откроется без входа: мы узнаём тебя по аккаунту Telegram.
          </p>
        </>
      }
    >
      <form onSubmit={handleAuth} className="space-y-5">
        {mode === "signup" && (
          <div>
            <label htmlFor="artistName" className={LABEL}>
              Имя артиста
            </label>
            <input
              id="artistName"
              type="text"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              required
              disabled={loading}
              autoComplete="name"
              placeholder="Как подписывать релизы"
              minLength={2}
              maxLength={120}
              className={FIELD}
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className={LABEL}>
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
            className={FIELD}
          />
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor="password" className="text-[13px] text-omf-graphite">
              Пароль
            </label>
            {mode === "login" && (
              <button
                type="button"
                onClick={() => router.push("/auth/reset-password")}
                className="omf-focus rounded-full text-[13px] text-omf-ultra-text transition-colors hover:text-omf-ink"
              >
                Забыл пароль
              </button>
            )}
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "signup" ? "Не короче 6 символов" : "Пароль"}
            minLength={6}
            className={FIELD}
          />
        </div>

        {error && <AuthMessage kind="error">{error}</AuthMessage>}
        {success && <AuthMessage kind="success">{success}</AuthMessage>}

        <button type="submit" disabled={loading} className="omf-btn-primary h-14 w-full text-[16px]">
          {loading ? "Секунду…" : mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-app items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-omf-line border-t-omf-ultra" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
