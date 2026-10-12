"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { PullRefreshBrand } from "@/components/PullRefreshBrand";
import { ReleaseCard } from "@/components/ReleaseCard";
import { LibraryReleaseSkeletonGrid } from "@/components/ui/LibrarySkeleton";
import { resumeDraftFromRelease } from "@/features/release/createRelease/actions";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import { normalizeReleaseStatus } from "@/lib/release-status";
import { getReleaseDisplayTitle } from "@/repositories/releases.repo";
import { useReleases, type ReleaseListRow } from "@/lib/hooks/useReleases";
import { hapticMap } from "@/lib/haptic-map";
import { toast } from "sonner";
import { AuthGuard } from "@/components/AuthGuard";
import { useIsTelegramMiniApp } from "@/lib/hooks/useIsTelegramMiniApp";
import { pickProfileGreetingName, useAuthProfile } from "@/lib/hooks/useAuthProfile";
import { cn } from "@/lib/utils";
import { getTelegramInitDataForApiHeader, getTelegramUserIdForSupabaseRequests } from "@/lib/telegram";


type LibraryStatusFilter = "all" | "processing" | "ready" | "failed";
type LibraryView = "all" | "drafts" | "moderation";

const STATUS_FILTER_CHIPS: { id: LibraryStatusFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "processing", label: "На проверке" },
  { id: "ready", label: "Одобрены" },
  { id: "failed", label: "Отклонены" }
];

function formatReleaseTypeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "single") return "Сингл";
  if (normalized === "ep") return "EP";
  if (normalized === "album") return "Альбом";
  return value;
}

function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "");
}

function parseLibraryView(value: string | null): LibraryView {
  if (value === "drafts" || value === "moderation") return value;
  return "all";
}

function LibraryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTelegram = useIsTelegramMiniApp();
  const {
    userId,
    authReady,
    authMode,
    telegramUser: user,
    greetingName,
    releases,
    data,
    error,
    isLoading,
    isValidating,
    mutate
  } = useReleases();

  const { data: authProfile } = useAuthProfile(
    Boolean(authReady && authMode === "web"),
    authMode === "web" ? userId : null
  );

  const isWeb = !isTelegram;

  const [resumingId, setResumingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LibraryStatusFilter>("all");
  const didRetryInitialEmptyRef = useRef(false);
  const didRetryStuckInitialLoadRef = useRef(false);
  const didHardReloadRef = useRef(false);
  const [telegramInitialEmptyRetries, setTelegramInitialEmptyRetries] = useState(0);
  const [adminNotesModal, setAdminNotesModal] = useState<{ title: string; body: string } | null>(
    null
  );
  const selectedView = parseLibraryView(searchParams.get("view"));

  useEffect(() => {
    if (searchParams.get("fromCreate") !== "1") return;
    void mutate(undefined, { revalidate: true });
    router.replace("/library");
  }, [searchParams, mutate, router]);

  /** После отправки релиза / входа на экран — перезапрос списка (SWR + RLS user id из стора). */
  useEffect(() => {
    if (!authReady || userId == null) return;
    void mutate(undefined, { revalidate: true });
  }, [authReady, userId, mutate]);

  /**
   * На "холодном" заходе без кэша сессия/headers могут синхронизироваться
   * чуть позже первого запроса. Делаем один безопасный автоповтор.
   */
  useEffect(() => {
    if (!authReady || userId == null) return;
    if (isLoading || isValidating) return;
    if (error != null) return;
    if (releases.length > 0) {
      didRetryInitialEmptyRef.current = false;
      return;
    }
    if (didRetryInitialEmptyRef.current) return;
    didRetryInitialEmptyRef.current = true;
    void mutate(undefined, { revalidate: true });
  }, [authReady, userId, isLoading, isValidating, error, releases.length, mutate]);

  /**
   * Если первичная загрузка "залипла", делаем один автоматический повтор.
   * Это покрывает кейс, когда первый запрос стартует слишком рано и не завершает SWR-цикл.
   */
  useEffect(() => {
    if (!authReady || userId == null) return;
    const waitingForFirstData = (data === undefined && error == null) || (isLoading || isValidating);
    if (!waitingForFirstData) {
      didRetryStuckInitialLoadRef.current = false;
      return;
    }
    if (didRetryStuckInitialLoadRef.current) return;
    didRetryStuckInitialLoadRef.current = true;
    const t = window.setTimeout(() => {
      void mutate(undefined, { revalidate: true });
    }, 5000);
    return () => {
      window.clearTimeout(t);
    };
  }, [authReady, userId, data, error, isLoading, isValidating, mutate]);

  /**
   * На iOS Telegram иногда первый ответ приходит пустым, а следующий (как при ручном refresh) уже с релизами.
   * Перед показом empty-state делаем до 3 быстрых авто-повторов только в Telegram.
   */
  useEffect(() => {
    if (!isTelegram) return;
    if (!authReady || userId == null || authMode !== "telegram") return;
    if (isLoading || isValidating) return;
    if (error != null) return;
    if (releases.length > 0) {
      if (telegramInitialEmptyRetries !== 0) setTelegramInitialEmptyRetries(0);
      return;
    }
    if (telegramInitialEmptyRetries >= 3) return;

    const t = window.setTimeout(() => {
      setTelegramInitialEmptyRetries((n) => n + 1);
      void mutate(undefined, { revalidate: true });
    }, 400);

    return () => window.clearTimeout(t);
  }, [
    isTelegram,
    authReady,
    userId,
    authMode,
    isLoading,
    isValidating,
    error,
    releases.length,
    mutate,
    telegramInitialEmptyRetries
  ]);

  /**
   * Telegram WebView иногда "подвисает" на первом SWR-цикле, но обычный refresh сразу лечит экран.
   * Делаем ровно один auto-refresh на холодном старте, чтобы не заставлять пользователя обновлять вручную.
   */
  useEffect(() => {
    if (!isTelegram) return;
    if (!authReady || userId == null || authMode !== "telegram") return;
    if (didHardReloadRef.current) return;
    const waitingForFirstData = (data === undefined && error == null) || isLoading || isValidating;
    if (!waitingForFirstData) return;

    let timer: number | null = window.setTimeout(() => {
      if (didHardReloadRef.current) return;
      try {
        const key = "__library_first_load_hard_reload_done";
        if (sessionStorage.getItem(key) === "1") return;
        sessionStorage.setItem(key, "1");
      } catch {
        // ignore
      }
      didHardReloadRef.current = true;
      window.location.reload();
    }, 9000);

    return () => {
      if (timer != null) {
        window.clearTimeout(timer);
      }
    };
  }, [isTelegram, authReady, userId, authMode, data, error, isLoading, isValidating]);

  const viewFilteredReleases = useMemo(() => {
    if (selectedView === "drafts") {
      return releases.filter((r) => {
        const status = normalizeReleaseStatus(r.status);
        return status === "draft" || status === "pending";
      });
    }
    if (selectedView === "moderation") {
      return releases.filter((r) => normalizeReleaseStatus(r.status) === "processing");
    }
    return releases;
  }, [releases, selectedView]);

  const filteredReleases = useMemo(() => {
    if (selectedView !== "all") return viewFilteredReleases;
    if (statusFilter === "all") return viewFilteredReleases;
    return viewFilteredReleases.filter((r) => normalizeReleaseStatus(r.status) === statusFilter);
  }, [viewFilteredReleases, selectedView, statusFilter]);

  const handleCreate = useCallback(() => {
    hapticMap.impactLight();
    router.push("/create/metadata");
  }, [router]);

  const handleResumeDraft = useCallback(
    async (release: ReleaseListRow) => {
      hapticMap.impactLight();
      setResumingId(release.id);
      try {
        const path = await resumeDraftFromRelease(release.id);
        if (!path) {
          const msg =
            useCreateReleaseDraftStore.getState().submitError ?? "Не удалось открыть черновик.";
          toast.error(msg);
          return;
        }
        router.push(path);
      } finally {
        setResumingId(null);
      }
    },
    [router]
  );

  const hasReleases = releases.length > 0;
  const hasReleasesInView = viewFilteredReleases.length > 0;
  const telegramIdentityReady =
    !isTelegram ||
    authMode !== "telegram" ||
    userId != null ||
    getTelegramUserIdForSupabaseRequests() != null ||
    getTelegramInitDataForApiHeader().length > 0;
  /** Нет контекста пользователя (сессия / Telegram) или ещё не инициализировали */
  const showAuthWait = !authReady || userId === null || authMode === null || !telegramIdentityReady;
  const telegramInitialSyncHold =
    isTelegram &&
    authReady &&
    userId != null &&
    authMode === "telegram" &&
    error == null &&
    releases.length === 0 &&
    telegramInitialEmptyRetries < 3;
  const showListSkeleton =
    !hasReleases &&
    (((!showAuthWait && data === undefined && error == null && (isLoading || isValidating)) ||
      telegramInitialSyncHold));
  const showEmptyState =
    authReady &&
    userId != null &&
    !showListSkeleton &&
    !isLoading &&
    error == null &&
    releases.length === 0 &&
    telegramIdentityReady &&
    (!isTelegram || telegramInitialEmptyRetries >= 3);

  const artistFirstName = pickProfileGreetingName(authProfile ?? undefined, greetingName);

  const isEmpty = !showAuthWait && !showListSkeleton && !error && releases.length === 0;

  const heroArtistName = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of releases) {
      const name = r.artist_name?.trim();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    counts.forEach((count, name) => {
      if (count > bestCount) {
        best = name;
        bestCount = count;
      }
    });
    return best ?? artistFirstName;
  }, [releases, artistFirstName]);

  const renderReleaseBlock = (release: ReleaseListRow, listIndex: number) => {
    const displayTitle = getReleaseDisplayTitle(release);
    const normalized = normalizeReleaseStatus(release.status);
    const isDraft = normalized === "draft" || normalized === "pending";
    const isFailed = normalized === "failed";
    const isResumingDraft = isDraft && resumingId === release.id;
    const subtitle = [
      formatReleaseTypeLabel(release.release_type ?? null),
      formatShortDate(release.created_at)
    ]
      .filter(Boolean)
      .join(" · ");

    const onCardClick = () => {
      if (isResumingDraft) return;
      if (isDraft) {
        void handleResumeDraft(release);
        return;
      }
      if (isFailed) {
        hapticMap.notificationError();
        const notes = release.admin_notes?.trim();
        setAdminNotesModal({
          title: displayTitle,
          body:
            notes && notes.length > 0
              ? notes
              : "Модератор не оставил комментарий. Напиши в поддержку, чтобы узнать причину."
        });
        return;
      }
      hapticMap.impactLight();
      router.push(`/release/${release.id}`);
    };

    return (
      <ReleaseCard
        key={release.id}
        id={release.id}
        title={displayTitle}
        artist={release.artist_name}
        subtitle={subtitle}
        status={normalized}
        coverUrl={release.artwork_url}
        priority={listIndex < 4}
        busy={isResumingDraft}
        onClick={onCardClick}
      />
    );
  };

  const newReleaseTile = (
    <button
      type="button"
      onClick={handleCreate}
      className="omf-focus block w-full min-w-0 text-left transition-transform duration-150 active:scale-[0.98]"
    >
      <span className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-sleeve border-[1.5px] border-dashed border-omf-line-strong text-omf-graphite transition-colors hover:border-omf-graphite hover:text-omf-ink">
        <Plus className="h-7 w-7" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="mt-2.5 block text-[14px] font-medium leading-tight text-omf-ink">Новый релиз</span>
      <span className="mt-0.5 block text-[12px] text-omf-graphite">Сингл, EP или альбом</span>
    </button>
  );

  const heroLabel =
    selectedView === "drafts" ? "Твои черновики" : selectedView === "moderation" ? "На модерации" : "Твои релизы";

  return (
    <div className="min-h-app text-omf-ink">
      <PullRefreshBrand />

      <div className={cn("mx-auto w-full px-1 pb-40 pt-6", isWeb ? "max-w-[1100px]" : "max-w-lg")}>
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] text-omf-graphite">{heroLabel}</p>
            <h1 className="mt-1 break-words text-[40px] font-extrabold leading-[0.92] tracking-[-0.045em] text-omf-ink sm:text-[52px]">
              {heroArtistName}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => {
              hapticMap.impactLight();
              void mutate(undefined, { revalidate: true });
            }}
            disabled={isValidating || showAuthWait}
            aria-label="Обновить список"
            className="omf-focus mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-omf-graphite transition-colors hover:bg-omf-surface hover:text-omf-ink disabled:opacity-40"
          >
            <RefreshCw className={cn("h-[18px] w-[18px]", isValidating && "animate-spin")} aria-hidden />
          </button>
        </header>

        {!hasReleases && (showAuthWait || showListSkeleton) ? (
          <div aria-busy="true">
            <p className="mb-4 text-[13px] text-omf-graphite">
              {!authReady
                ? "Загрузка…"
                : userId === null || authMode === null
                  ? "Подключаем Telegram…"
                  : "Загружаем релизы…"}
            </p>
            <LibraryReleaseSkeletonGrid count={4} />
          </div>
        ) : !showListSkeleton && error != null ? (
          <div className="border-t border-omf-line pt-6">
            <p className="text-[18px] font-bold tracking-tight">Не удалось загрузить релизы</p>
            <p className="mt-1.5 text-[14px] text-omf-graphite">
              Проверь интернет и попробуй ещё раз. Если не поможет, перезапусти приложение.
            </p>
            <button
              type="button"
              className="omf-btn-primary mt-5"
              onClick={() => void mutate(undefined, { revalidate: true })}
            >
              Загрузить снова
            </button>
          </div>
        ) : showEmptyState && isEmpty ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            {newReleaseTile}
            <div className="col-span-2 -mt-1">
              <p className="text-[18px] font-bold tracking-tight">Выпусти первый релиз</p>
              <p className="mt-1.5 max-w-[34ch] text-[14px] leading-relaxed text-omf-graphite">
                Заполни паспорт, добавь обложку и WAV. Модератор проверит релиз и отправит его на площадки.
              </p>
              <button type="button" onClick={handleCreate} className="omf-btn-primary mt-5 w-full sm:w-auto">
                Создать релиз
              </button>
            </div>
          </div>
        ) : (
          <>
            {hasReleasesInView && error == null && selectedView === "all" && (
              <div
                className="mb-6 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Фильтр по статусу"
              >
                {STATUS_FILTER_CHIPS.map((chip) => {
                  const active = statusFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        hapticMap.impactLight();
                        setStatusFilter(chip.id);
                      }}
                      className={cn(
                        "omf-focus shrink-0 rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
                        active
                          ? "bg-omf-ink font-medium text-omf-bg"
                          : "text-omf-graphite hover:text-omf-ink"
                      )}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            )}

            {hasReleasesInView && filteredReleases.length === 0 && (
              <p className="mb-6 text-[14px] text-omf-graphite">С таким статусом релизов нет.</p>
            )}

            {!hasReleasesInView && hasReleases && selectedView !== "all" && (
              <p className="mb-6 text-[14px] text-omf-graphite">Здесь пока пусто.</p>
            )}

            <div
              className={cn(
                "grid grid-cols-2 gap-x-4 gap-y-7",
                isWeb && "sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6"
              )}
            >
              {filteredReleases.map((release, i) => renderReleaseBlock(release, i))}
              {selectedView !== "moderation" ? newReleaseTile : null}
            </div>
          </>
        )}
      </div>

      {adminNotesModal && (
        <div
          key="admin-notes-modal"
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setAdminNotesModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-notes-title"
            className="w-full max-w-[420px] rounded-[20px] border border-omf-line bg-omf-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] text-omf-graphite">{adminNotesModal.title}</p>
                <h2 id="admin-notes-title" className="mt-0.5 text-[18px] font-bold tracking-tight text-omf-ink">
                  Почему релиз отклонён
                </h2>
              </div>
              <button
                type="button"
                className="omf-focus -mr-1 rounded-full p-1.5 text-omf-graphite hover:bg-omf-surface-2 hover:text-omf-ink"
                aria-label="Закрыть"
                onClick={() => setAdminNotesModal(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-omf-ink">
              {adminNotesModal.body}
            </p>
            <button
              type="button"
              className="omf-btn-secondary mt-5 w-full"
              onClick={() => setAdminNotesModal(null)}
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <AuthGuard>
      <Suspense
        fallback={
          <div className="min-h-app px-5 pb-40 pt-10">
            <div className="mx-auto max-w-lg">
              <div className="mb-8 h-[84px] w-3/4 animate-pulse rounded-control bg-omf-surface" />
              <LibraryReleaseSkeletonGrid count={4} />
            </div>
          </div>
        }
      >
        <LibraryPageInner />
      </Suspense>
    </AuthGuard>
  );
}
