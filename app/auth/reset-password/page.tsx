"use client";

import { useState, Suspense } from "react";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
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

      setSuccess(true);
    } catch (err: any) {
      console.error("Reset password error:", err);
      setError(err.message || "Не удалось отправить письмо для сброса пароля");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-5 py-10">
        {/* Background gradient */}
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#0a0a0f] via-[#13131a] to-[#0a0a0f]" />
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 mb-4"
            >
              <Sparkles className="text-indigo-400" size={32} />
              <h1 className="text-3xl font-bold gradient-text-blue">OMF Distribution</h1>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="glass p-10 rounded-2xl text-center"
          >
            <CheckCircle2 className="mx-auto mb-4 text-green-400" size={48} />
            <h2 className="text-xl font-semibold text-white mb-2">
              Письмо отправлено!
            </h2>
            <p className="text-white/60 text-sm mb-6">
              Проверьте почту <span className="font-medium text-white/80">{email}</span>.
              <br />
              Мы отправили вам ссылку для сброса пароля.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200"
            >
              Вернуться к входу
            </button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-5 py-10">
      {/* Background gradient */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#0a0a0f] via-[#13131a] to-[#0a0a0f]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Назад</span>
        </button>

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
          <p className="text-white/60 text-sm">Сброс пароля</p>
        </div>

        {/* Reset Form */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="glass p-8 rounded-2xl"
        >
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-white mb-2">
                Забыли пароль?
              </h2>
              <p className="text-white/60 text-sm">
                Введите ваш email и мы отправим ссылку для сброса пароля
              </p>
            </div>

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
                  <span>Отправляем...</span>
                </>
              ) : (
                <>
                  <Mail size={18} />
                  <span>Отправить ссылку</span>
                </>
              )}
            </motion.button>
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
