"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Disc3, MessageCircle, Music2, Radio } from "lucide-react";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import type { ArtistLinksState } from "@/lib/artist-links";
import { EMPTY_ARTIST_LINKS } from "@/lib/artist-links";
import { GLASS_FIELD_BASE } from "@/lib/glass-form-classes";
import { hapticMap } from "@/lib/haptic-map";

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
  /** По умолчанию «новый артист»; раскрытие только после включения тумблера или при уже сохранённых ссылках. */
  const [hasProfiles, setHasProfiles] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasAnyLink) setHasProfiles(true);
  }, [hasAnyLink]);

  useEffect(() => {
    if (!hasProfiles) return;
    const id = window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [hasProfiles]);

  const toggleProfiles = (next: boolean) => {
    hapticMap.impactLight();
    setHasProfiles(next);
    if (!next) {
      setReleaseArtistLinks({ ...EMPTY_ARTIST_LINKS });
    }
  };

  return (
    <div ref={panelRef} className="min-w-0 space-y-3 rounded-[16px] border border-white/[0.08] bg-black/25 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
        <label
          htmlFor="artist-has-profiles"
          className="min-w-0 cursor-pointer text-[13px] leading-snug text-white/85"
        >
          У меня уже есть профили на площадках
        </label>
        <button
          id="artist-has-profiles"
          type="button"
          role="switch"
          aria-checked={hasProfiles}
          onClick={() => toggleProfiles(!hasProfiles)}
          className={`relative inline-flex h-8 w-[52px] shrink-0 items-center justify-start rounded-full px-[3px] transition-colors ${
            hasProfiles ? "bg-blue-600" : "bg-white/15"
          }`}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            animate={{ x: hasProfiles ? 22 : 0 }}
            className="h-6 w-6 rounded-full bg-white shadow-sm"
          />
        </button>
      </div>
      <p className="text-[10px] leading-snug text-white/40">
        Не включайте, если вы только начинаете — ссылки необязательны. При включении укажите хотя бы
        одну корректную ссылку на карточку артиста.
      </p>

      <AnimatePresence initial={false}>
        {hasProfiles && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.32 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-3">
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
