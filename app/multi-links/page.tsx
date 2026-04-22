"use client";

import { Suspense, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link2, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { MultiLinkReleaseRow } from "@/components/MultiLinkReleaseRow";
import { PullRefreshBrand } from "@/components/PullRefreshBrand";
import { LibraryReleaseSkeletonGrid } from "@/components/ui/LibrarySkeleton";
import { getReleaseDisplayTitle } from "@/repositories/releases.repo";
import { useReleases } from "@/lib/hooks/useReleases";
import { shouldShowSmartLinkCta } from "@/lib/smart-link-cta";
import { hapticMap } from "@/lib/haptic-map";
import { cn } from "@/lib/utils";
import { useIsTelegramMiniApp } from "@/lib/hooks/useIsTelegramMiniApp";

type SortMode = "date_desc" | "date_asc" | "title";

function normalizeSearch(s: string): string {
  return s.trim().toLowerCase();
}

function MultiLinksPageInner() {
  const isTelegram = useIsTelegramMiniApp();
  const router = useRouter();
  const {
    authReady,
    userId,
    releases,
    isBootstrapping,
    error,
    isValidating
  } = useReleases();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("date_desc");

  const withLinks = useMemo(() => {
    return releases.filter(
      (r) => shouldShowSmartLinkCta(r.status, r.smart_link) && (r.smart_link?.trim() ?? "").length > 0
    );
  }, [releases]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    let rows = withLinks;
    if (q) {
      rows = rows.filter((r) => {
        const title = normalizeSearch(getReleaseDisplayTitle(r));
        const artist = normalizeSearch(r.artist_name ?? "");
        const link = normalizeSearch(r.smart_link ?? "");
        return title.includes(q) || artist.includes(q) || link.includes(q);
      });
    }
    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (sort === "title") {
        return getReleaseDisplayTitle(a).localeCompare(getReleaseDisplayTitle(b), "ru");
      }
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sort === "date_desc" ? tb - ta : ta - tb;
    });
    return sorted;
  }, [withLinks, query, sort]);

  const showSkeleton = !authReady || userId == null || isBootstrapping;

  return (
    <div className={cn("min-h-app", isTelegram ? "px-3 pb-44 pt-4" : "pb-16 pt-6")}>
      <PullRefreshBrand />
      <div className="mx-auto w-full max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-start gap-3"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-500/25 bg-violet-500/10 text-violet-300">
            <Link2 className="h-6 w-6" strokeWidth={2} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white/90 md:text-3xl">
              Мультиссылки
            </h1>
            <p className="mt-1 max-w-xl text-[14px] leading-relaxed text-white/55">
              Единые ссылки для продвижения выпущенных релизов — откройте, скопируйте или перейдите к
              карточке.
            </p>
          </div>
        </motion.div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/35" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию, артисту или ссылке"
              className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-[14px] text-white placeholder:text-white/35 outline-none ring-violet-500/30 focus:ring-2"
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                { id: "date_desc" as const, label: "Сначала новые" },
                { id: "date_asc" as const, label: "Сначала старые" },
                { id: "title" as const, label: "По названию" }
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  hapticMap.impactLight();
                  setSort(opt.id);
                }}
                className={cn(
                  "shrink-0 rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors",
                  sort === opt.id
                    ? "border-violet-500/45 bg-violet-500/15 text-white"
                    : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="glass-glow glass-glow-charged mb-4 p-4 text-sm text-rose-200">
            {error instanceof Error ? error.message : "Не удалось загрузить релизы."}
          </div>
        )}

        {showSkeleton ? (
          <LibraryReleaseSkeletonGrid count={4} />
        ) : filtered.length === 0 ? (
          <div className="glass-glow glass-glow-charged p-8 text-center">
            <p className="text-[15px] font-medium text-white/80">
              {withLinks.length === 0
                ? "Пока нет выпущенных релизов со смарт-ссылкой."
                : "Ничего не найдено по запросу."}
            </p>
            <p className="mt-2 text-[13px] text-white/45">
              Ссылку добавляет модерация после одобрения релиза. Здесь отображаются только активные
              мультиссылки.
            </p>
            {withLinks.length === 0 && (
              <button
                onClick={() => router.push("/create/metadata")}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white"
              >
                <Plus className="h-4 w-4" />
                Загрузить новый релиз
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((r, i) => (
              <MultiLinkReleaseRow
                key={r.id}
                releaseId={r.id}
                title={getReleaseDisplayTitle(r)}
                artist={(r.artist_name ?? "").trim() || "Артист"}
                smartLink={r.smart_link!.trim()}
                coverUrl={r.artwork_url}
                index={i}
              />
            ))}
          </div>
        )}

        {!showSkeleton && (
          <p className="mt-6 text-center text-[11px] text-white/30">
            {isValidating ? "Обновление…" : "\u00a0"}
          </p>
        )}
      </div>
    </div>
  );
}

export default function MultiLinksPage() {
  return (
    <AuthGuard>
      <Suspense
        fallback={
          <div className="min-h-app px-5 pb-44 pt-14">
            <div className="mx-auto max-w-3xl space-y-6">
              <div className="h-24 animate-pulse rounded-[1.25rem] bg-white/[0.06]" />
              <LibraryReleaseSkeletonGrid count={4} />
            </div>
          </div>
        }
      >
        <MultiLinksPageInner />
      </Suspense>
    </AuthGuard>
  );
}
