"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { FeedbackCard } from "@/components/FeedbackCard";
import { LibraryWebAside } from "@/components/library/LibraryWebAside";

export default function RequirementsPage() {
  return (
    <AuthGuard>
      <div className="mx-auto min-h-app w-full max-w-lg px-1 pb-40 pt-6 text-omf-ink">
        <header className="mb-6">
          <p className="text-[13px] text-omf-graphite">Правила и ответы</p>
          <h1 className="mt-1 text-[40px] font-extrabold leading-[0.92] tracking-[-0.045em]">Помощь</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-omf-graphite">
            Требования к файлам, даты выхода, фиты и статусы модерации.
          </p>
        </header>
        <LibraryWebAside />
        <div className="mt-8">
          <FeedbackCard />
        </div>
      </div>
    </AuthGuard>
  );
}
