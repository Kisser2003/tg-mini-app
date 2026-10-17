"use client";

import { useCallback, useState } from "react";
import { Check, ClipboardCopy, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminDownloadToDisk } from "@/features/admin/download";
import { formatPressKitUpdatedAt, isPressKitFilled, type PressKit } from "@/lib/press-kit";
import { triggerHaptic } from "@/lib/telegram";

type Props = {
  releaseId: string;
  kit: PressKit | null;
  hasArtwork: boolean;
};

/** Питчинг: что артист прислал для редакций площадок. Текст — в буфер, фото и обложка — файлами. */
export function AdminPressKitPanel({ releaseId, kit, hasArtwork }: Props) {
  const text = kit?.press_text?.trim() ?? "";
  const filled = isPressKitFilled(kit);
  const [copied, setCopied] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      triggerHaptic("success");
      toast.success("Пресс-релиз скопирован");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      triggerHaptic("error");
      toast.error("Не удалось скопировать");
    }
  }, [text]);

  const download = useCallback(async (key: string, kind: string, fallback: string) => {
    setBusyKey(key);
    try {
      await adminDownloadToDisk(`/api/admin/releases/${releaseId}/download?kind=${kind}`, fallback);
      triggerHaptic("success");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось скачать файл");
      triggerHaptic("error");
    } finally {
      setBusyKey(null);
    }
  }, [releaseId]);

  return (
    <section className="mt-2 border-t border-omf-line pt-4" aria-labelledby="admin-pitching">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="admin-pitching" className="text-[13px] text-omf-graphite">
          Питчинг
        </h2>
        <p className={filled ? "text-[13px] text-omf-green" : "text-[13px] text-omf-faint"}>
          {filled && kit?.updated_at ? `Заполнено ${formatPressKitUpdatedAt(kit.updated_at)}` : "Артист ещё не заполнил"}
        </p>
      </div>

      {text ? (
        <p className="mb-3 whitespace-pre-wrap break-words rounded-control bg-omf-surface p-3 text-[14px] leading-relaxed">
          {text}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!text}
          onClick={() => void onCopy()}
          className="omf-btn-ink w-full justify-start gap-3 px-4 text-[14px] disabled:opacity-50"
        >
          {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
          {text ? "Скопировать пресс-релиз" : "Текста пока нет"}
        </button>

        {kit?.photo_url ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed URL приватного бакета */}
            <img
              src={kit.photo_url}
              alt="Фото артиста"
              className="h-14 w-14 shrink-0 rounded-control bg-omf-surface object-cover"
            />
            <button
              type="button"
              disabled={busyKey !== null}
              onClick={() => void download("photo", "press_photo", `press-photo-${releaseId}`)}
              className="omf-btn-secondary min-w-0 flex-1 justify-start gap-3 px-4 text-[14px] disabled:opacity-50"
            >
              {busyKey === "photo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Фото артиста
            </button>
          </div>
        ) : (
          <p className="text-[14px] text-omf-graphite">Фото артиста нет.</p>
        )}

        {hasArtwork ? (
          <button
            type="button"
            disabled={busyKey !== null}
            onClick={() => void download("artwork", "artwork", `cover-${releaseId}`)}
            className="omf-btn-secondary w-full justify-start gap-3 px-4 text-[14px] disabled:opacity-50"
          >
            {busyKey === "artwork" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Обложка релиза
          </button>
        ) : null}
      </div>
    </section>
  );
}
