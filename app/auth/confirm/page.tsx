"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, Sparkles } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase";

type ConfirmStatus = "loading" | "success" | "error";

function ConfirmEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<ConfirmStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const confirmEmail = async () => {
      const supabase = createSupabaseBrowser();

      // Supabase автоматически обрабатывает токены из URL
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Confirmation error:", error);
        setErrorMessage(error.message || "Не удалось подтвердить email");
        setStatus("error");
        return;
      }

      if (data.session) {
        setStatus("success");
        // Редирект через 2 секунды
        setTimeout(() => {
          const redirect = searchParams.get("redirect") || "/library";
          router.push(redirect);
        }, 2000);
      } else {
        setErrorMessage("Сессия не найдена");
        setStatus("error");
      }
    };

    confirmEmail();
  }, [router, searchParams]);

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

        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="glass p-10 rounded-2xl text-center"
        >
          {status === "loading" && (
            <>
              <Loader2 className="mx-auto mb-4 text-indigo-400 animate-spin" size={48} />
              <h2 className="text-xl font-semibold text-white mb-2">
                Подтверждаем email
              </h2>
              <p className="text-white/60 text-sm">Пожалуйста, подождите...</p>
            </>
          )}

          {status === "success" && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.6 }}
              >
                <CheckCircle2 className="mx-auto mb-4 text-green-400" size={48} />
              </motion.div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Email подтвержден!
              </h2>
              <p className="text-white/60 text-sm">
                Перенаправляем вас в приложение...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="mx-auto mb-4 text-red-400" size={48} />
              <h2 className="text-xl font-semibold text-white mb-2">
                Ошибка подтверждения
              </h2>
              <p className="text-white/60 text-sm mb-6">{errorMessage}</p>
              <button
                onClick={() => router.push("/login")}
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200"
              >
                Вернуться к входу
              </button>
            </>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center">
          <Loader2 className="text-indigo-400 animate-spin" size={48} />
        </div>
      }
    >
      <ConfirmEmailContent />
    </Suspense>
  );
}
