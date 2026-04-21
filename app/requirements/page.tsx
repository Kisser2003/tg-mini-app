"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { FeedbackCard } from "@/components/FeedbackCard";
import { LibraryWebAside } from "@/components/library/LibraryWebAside";

export default function RequirementsPage() {
  return (
    <AuthGuard>
      <div className="min-h-app px-5 pb-44 pt-14 text-foreground">
        <div className="mx-auto w-full max-w-[760px]">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-white/90">
              FAQ
            </h1>
            <p className="mt-1 text-sm text-white/45">
              Краткая памятка по подготовке релиза перед отправкой.
            </p>
          </div>
          <LibraryWebAside />
          <div className="mt-5">
            <FeedbackCard />
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
