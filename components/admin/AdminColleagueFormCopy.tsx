"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import { buildColleagueReleaseForm, type AdminReleaseRow } from "@/lib/admin-release-metadata";
import { triggerHaptic } from "@/lib/telegram";
import type { ReleaseRecord, ReleaseTrackRow } from "@/repositories/releases/types";

/** Одна кнопка: «Форма релиза» для рабочего чата. Файлы отправляются отдельно кнопками ниже. */
export function AdminColleagueFormCopy({
  release,
  tracks
}: {
  release: ReleaseRecord;
  tracks: ReleaseTrackRow[];
}) {
  const text = useMemo(
    () => buildColleagueReleaseForm(release as AdminReleaseRow, tracks),
    [release, tracks]
  );
  const missing = useMemo(
    () => new Set(text.split("\n").filter((l) => /^[\d.]+ .+: —$/.test(l))).size,
    [text]
  );
  const [done, setDone] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      triggerHaptic("success");
      toast.success("Форма скопирована — вставьте в чат");
      window.setTimeout(() => setDone(false), 1600);
    } catch {
      triggerHaptic("error");
      toast.error("Не удалось скопировать");
    }
  }, [text]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void onCopy()}
        className="omf-btn-ink w-full justify-start gap-3 px-4 text-[14px]"
      >
        {done ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
        Скопировать форму для коллег
      </button>
      <p className="text-[13px] leading-relaxed text-omf-faint">
        {missing > 0
          ? `Не заполнено полей: ${missing} — в тексте стоит «—». `
          : ""}
        Обложку, WAV и текст отправьте файлами кнопками ниже.
      </p>
    </div>
  );
}
