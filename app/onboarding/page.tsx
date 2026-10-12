"use client";

import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-md flex-col justify-center px-5 pb-12 text-omf-ink">
      <p className="text-[15px] font-extrabold tracking-[-0.02em] text-omf-ultra-text">OMF</p>
      <h1 className="mt-3 text-[44px] font-extrabold leading-[0.92] tracking-[-0.045em]">
        Выпускай музыку без лейбла
      </h1>
      <p className="mt-4 text-[16px] leading-relaxed text-omf-graphite">
        Загрузи трек и обложку, а модератор проверит релиз и отправит его на площадки.
      </p>
      <button type="button" onClick={() => router.push("/")} className="omf-btn-primary mt-10 h-14 w-full text-[16px]">
        Продолжить через Telegram
      </button>
    </div>
  );
}
