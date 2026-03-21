"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Disc3, MessageCircle, Music2, Radio } from "lucide-react";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import type { ArtistLinksState } from "@/lib/artist-links";
import { GLASS_FIELD_BASE } from "@/lib/glass-form-classes";

const FIELDS: {
  key: keyof ArtistLinksState;
  label: string;
  Icon: typeof Music2;
  placeholder: string;
}[] = [
  {
    key: "spotify",
    label: "Spotify",
    Icon: Music2,
    placeholder: "https://open.spotify.com/artist/…"
  },
  {
    key: "apple",
    label: "Apple Music",
    Icon: Disc3,
    placeholder: "https://music.apple.com/…/artist/…"
  },
  {
    key: "yandex",
    label: "Yandex Music",
    Icon: Radio,
    placeholder: "https://music.yandex.ru/artist/…"
  },
  {
    key: "vk",
    label: "VK",
    Icon: MessageCircle,
    placeholder: "https://vk.com/artist/…"
  }
];

export function ArtistProfileLinksSection() {
  const releaseArtistLinks = useCreateReleaseDraftStore((s) => s.releaseArtistLinks);
  const setReleaseArtistLinks = useCreateReleaseDraftStore((s) => s.setReleaseArtistLinks);

  const hasAnyLink = FIELDS.some(({ key }) => releaseArtistLinks[key].trim().length > 0);
  /** По умолчанию свёрнуто; раскрывается при клике или если уже есть сохранённые ссылки. */
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasAnyLink) setOpen(true);
  }, [hasAnyLink]);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  return (
    <div ref={panelRef} className="min-w-0 space-y-2 rounded-[16px] border border-white/[0.08] bg-black/25 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 space-y-0.5">
          <p className="text-[12px] font-semibold text-white">Профили на площадках</p>
          <p className="text-[10px] leading-snug text-white/45">
            Если карточки уже есть — укажите ссылки, чтобы релиз не привязался к чужой странице.
            Необязательно.
          </p>
        </div>
        <ChevronDown
          className={`mt-0.5 h-5 w-5 shrink-0 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.32 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 pt-1">
              {FIELDS.map(({ key, label, Icon, placeholder }) => (
                <div key={key} className="min-w-0 space-y-1">
                  <label className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white/55">
                    <Icon className="h-3.5 w-3.5 text-white/40" aria-hidden />
                    {label}
                  </label>
                  <input
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    value={releaseArtistLinks[key]}
                    onChange={(e) => setReleaseArtistLinks({ [key]: e.target.value })}
                    placeholder={placeholder}
                    className={`${GLASS_FIELD_BASE} min-h-[44px] text-[15px] placeholder:text-white/35`}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
