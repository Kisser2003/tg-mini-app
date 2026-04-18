"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn, UserPlus, Mail, Lock, AlertCircle, Sparkles, UserRound } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase";
import { useIsTelegramMiniApp } from "@/lib/hooks/useIsTelegramMiniApp";

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
    router.replace(redirectTo.startsWith("/") ? redirectTo : "/library");
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
          setError("Укажите имя артиста (минимум 2 символа).");
          setLoading(false);
          return;
        }
        if (name.length > 120) {
          setError("Имя слишком длинное (максимум 120 символов).");
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
          setSuccess("Аккаунт создан! Перенаправляем...");
          setTimeout(() => {
            router.refresh();
            router.push(redirectTo);
          }, 1500);
        } else if (data.user) {
          // Email требует подтверждения
          setSuccess("Проверьте email для подтверждения аккаунта. Письмо отправлено на " + email);
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) throw signInError;

        if (data.session) {
          setSuccess("Вход выполнен! Перенаправляем...");
          setTimeout(() => {
            router.refresh();
            router.push(redirectTo);
          }, 800);
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || "Ошибка авторизации");
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

  return (
    <div className="flex min-h-app items-center justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 mb-4"
          >
            <Sparkles className="text-indigo-400" size={32} />
            <h1 className="text-3xl font-bold gradient-text-blue">OMF Distribution</h1>
          </motion.div>
          <p className="text-white/60 text-sm">
            {mode === "login" ? "Войдите в ваш аккаунт" : "Создайте новый аккаунт"}
          </p>
        </div>

        {/* Auth Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="glass p-8 rounded-2xl"
        >
          <form onSubmit={handleAuth} className="space-y-6">
            {/* Имя артиста — только регистрация */}
            {mode === "signup" && (
              <div>
                <label htmlFor="artistName" className="block text-sm font-medium text-white/80 mb-2">
                  Имя артиста
                </label>
                <div className="relative">
                  <UserRound
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
                    size={18}
                  />
                  <input
                    id="artistName"
                    type="text"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="name"
                    placeholder="Как вас показывать в релизах"
                    minLength={2}
                    maxLength={120}
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 transition-all disabled:opacity-50"
                  />
                </div>
                <p className="mt-1 text-xs text-white/50">
                  Сценическое имя или имя для приветствия в сервисе
                </p>
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-white/80">
                  Пароль
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => router.push("/auth/reset-password")}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Забыли пароль?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20 transition-all disabled:opacity-50"
                />
              </div>
              {mode === "signup" && (
                <p className="mt-1 text-xs text-white/50">Минимум 6 символов</p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Success Message */}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400"
              >
                <Sparkles size={16} className="shrink-0 mt-0.5" />
                <span>{success}</span>
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Загрузка...</span>
                </>
              ) : mode === "login" ? (
                <>
                  <LogIn size={18} />
                  <span>Войти</span>
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>Зарегистрироваться</span>
                </>
              )}
            </motion.button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={toggleMode}
              disabled={loading}
              className="text-sm text-white/60 hover:text-white transition-colors disabled:opacity-50"
            >
              {mode === "login" ? (
                <>
                  Нет аккаунта?{" "}
                  <span className="text-indigo-400 font-medium">Зарегистрируйтесь</span>
                </>
              ) : (
                <>
                  Уже есть аккаунт? <span className="text-indigo-400 font-medium">Войдите</span>
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-center text-xs text-white/40"
        >
          <p>Веб-версия для управления вашими релизами</p>
          <p className="mt-1">Также доступно в Telegram Mini App</p>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-app items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-400" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
