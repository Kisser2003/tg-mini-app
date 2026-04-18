"use client";

import { useLayoutEffect } from "react";
import { useRouter } from "next/navigation";

// The /create route is a pure entry-point that immediately sends the user to
// the first step of the wizard.  Using a client-side useLayoutEffect redirect
// instead of a server redirect() avoids the blank-page flicker that occurs
// when Next.js has to make an extra server round-trip for the redirect during
// client-side navigation (e.g. when the user clicks "New Release" on the
// library page).  useLayoutEffect fires before the browser paints, so the user
// sees the spinner (rendered below) for at most one frame.
export default function CreateEntryPage() {
  const router = useRouter();

  useLayoutEffect(() => {
    const q = typeof window !== "undefined" ? window.location.search : "";
    router.replace(q ? `/create/metadata${q}` : "/create/metadata");
  }, [router]);

  return (
    <div className="bg-background flex min-h-app items-center justify-center">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-[#7C3AED]"
        aria-label="Загрузка…"
      />
    </div>
  );
}
