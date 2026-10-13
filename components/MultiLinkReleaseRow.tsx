"use client";

import Link from "next/link";
import { Copy, ExternalLink } from "lucide-react";
import { ReleaseSleeve } from "@/components/ReleaseSleeve";
import { toast } from "sonner";
import { openSmartLink } from "@/lib/open-smart-link";
import { hapticMap } from "@/lib/haptic-map";

export type MultiLinkReleaseRowProps = {
  releaseId: string;
  title: string;
  artist: string;
  smartLink: string;
  coverUrl?: string | null;
  index?: number;
};

function compactUrlForCard(url: string): string {
  const t = url.trim();
  try {
    const u = new URL(t);
    const path = u.pathname.replace(/\/$/, "");
    const tail = path && path !== "/" ? path : "";
    return `${u.hostname.replace(/^www\./, "")}${tail}`;
  } catch {
    return t.length > 48 ? `${t.slice(0, 45)}…` : t;
  }
}

export function MultiLinkReleaseRow({
  releaseId,
  title,
  artist,
  smartLink,
  coverUrl
}: MultiLinkReleaseRowProps) {
  const lineUrl = compactUrlForCard(smartLink);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(smartLink.trim());
      hapticMap.notificationSuccess();
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не получилось скопировать. Выдели ссылку и скопируй вручную.");
    }
  };

  return (
    <article className="border-b border-omf-line py-5">
      <div className="flex items-center gap-3.5">
        <div className="w-[72px] shrink-0">
          <ReleaseSleeve seed={releaseId} title={title} artist={artist} coverUrl={coverUrl} size="thumb" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold leading-tight tracking-[-0.02em]">{title}</p>
          <p className="mt-0.5 truncate text-[14px] text-omf-graphite">{artist}</p>
          <p className="mt-1.5 truncate text-[13px] text-omf-ultra-text" title={smartLink}>
            {lineUrl}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2.5">
        <button
          type="button"
          onClick={() => {
            hapticMap.impactLight();
            openSmartLink(smartLink);
          }}
          className="omf-btn-ink w-full"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Открыть ссылку
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label="Скопировать ссылку"
          className="omf-btn-secondary w-12 px-0"
        >
          <Copy className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <Link
        href={`/release/${releaseId}`}
        onClick={() => hapticMap.impactLight()}
        className="omf-focus omf-press mt-3 inline-block rounded-full text-[14px] text-omf-graphite hover:text-omf-ink"
      >
        Страница релиза
      </Link>
    </article>
  );
}
