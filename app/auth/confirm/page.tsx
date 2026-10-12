"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
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
        setErrorMessage(error.message || "Не удалось подтвердить почту");
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
        setErrorMessage("Ссылка устарела или уже использована");
        setStatus("error");
      }
    };

    confirmEmail();
  }, [router, searchParams]);

  return (
    <AuthShell
      title={
        status === "loading" ? "Подтверждаем почту" : status === "success" ? "Почта подтверждена" : "Не получилось подтвердить"
      }
      subtitle={
        status === "loading"
          ? "Это займёт пару секунд."
          : status === "success"
            ? "Открываем приложение…"
            : `${errorMessage}. Попробуй войти или запроси письмо ещё раз.`
      }
    >
      {status === "error" ? (
        <button type="button" onClick={() => router.push("/login")} className="omf-btn-primary h-14 w-full text-[16px]">
          Ко входу
        </button>
      ) : (
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-omf-line border-t-omf-ultra"
          role="status"
          aria-label={status === "loading" ? "Подтверждаем" : "Открываем приложение"}
        />
      )}
    </AuthShell>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-app items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-omf-line border-t-omf-ultra" />
        </div>
      }
    >
      <ConfirmEmailContent />
    </Suspense>
  );
}
