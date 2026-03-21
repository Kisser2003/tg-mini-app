"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Disc3, MessageCircle, Music2, Radio } from "lucide-react";
import { useCreateReleaseDraftStore } from "@/features/release/createRelease/store";
import { EMPTY_ARTIST_LINKS, type ArtistLinksState } from "@/lib/artist-links";
import { hapticMap } from "@/lib/haptic-map";
import { GLASS_FIELD_BASE } from "@/lib/glass-form-classes";

type Step = "choice" | "links";

type Props = {
  open: boolean;
};

const linkFields: {
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

export function ArtistSetupModal({ open }: Props) {
  const setReleaseArtistLinks = useCreateReleaseDraftStore((s) => s.setReleaseArtistLinks);
  const setArtistSetupGateCompleted = useCreateReleaseDraftStore((s) => s.setArtistSetupGateCompleted);

  const [step, setStep] = useState<Step>("choice");
  const [draftLinks, setDraftLinks] = useState<ArtistLinksState>({ ...EMPTY_ARTIST_LINKS });

  useEffect(() => {
    if (open) {
      setStep("choice");
      setDraftLinks({ ...EMPTY_ARTIST_LINKS });
    }
  }, [open]);

  const handleNewArtist = () => {
    setReleaseArtistLinks({ ...EMPTY_ARTIST_LINKS });
    setArtistSetupGateCompleted(true);
    hapticMap.impactLight();
  };

  const handleOpenLinks = () => {
    setStep("links");
    hapticMap.impactLight();
  };

  const handleConfirmLinks = () => {
    setReleaseArtistLinks(draftLinks);
    setArtistSetupGateCompleted(true);
    hapticMap.notificationSuccess();
  };

  const handleBack = () => {
    setStep("choice");
    hapticMap.impactLight();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-modal="true"
          role="dialog"
          aria-labelledby="artist-setup-title"
        >
          <motion.div
            layout
            className="w-full max-w-md overflow-hidden rounded-[24px] border border-white/[0.08] bg-surface/95 px-5 py-6 shadow-2xl"
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {step === "choice" ? (
                <motion.div
                  key="choice"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <h2
                    id="artist-setup-title"
                    className="text-center text-[17px] font-semibold leading-snug text-white"
                  >
                    У вас уже есть профили артиста?
                  </h2>
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={handleNewArtist}
                      className="rounded-[18px] border border-white/[0.1] bg-gradient-to-tr from-violet-600/95 to-indigo-600/95 px-5 py-4 text-[15px] font-semibold text-white shadow-lg transition active:scale-[0.99]"
                    >
                      Я Новый Исполнитель
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenLinks}
                      className="rounded-[18px] border border-white/15 bg-white/[0.06] px-5 py-4 text-[15px] font-semibold text-white/95 transition hover:bg-white/[0.1] active:scale-[0.99]"
                    >
                      У меня есть карточка
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="links"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <h2
                    id="artist-setup-title"
                    className="text-[16px] font-semibold text-white"
                  >
                    Ссылки на карточки
                  </h2>
                  <p className="text-[12px] leading-relaxed text-white/55">
                    Укажите ссылки на ваши страницы — так мы не привяжем релиз к чужим профилям. Можно
                    заполнить не все поля.
                  </p>
                  <div className="max-h-[min(52vh,420px)] space-y-3 overflow-y-auto pr-1">
                    {linkFields.map(({ key, label, Icon, placeholder }) => (
                      <div
                        key={key}
                        className="flex items-start gap-3 rounded-[16px] border border-white/[0.06] bg-black/35 px-3 py-3"
                      >
                        <div
                          className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.06]"
                          aria-hidden
                        >
                          <Icon className="h-[17px] w-[17px] text-white/75" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <label
                            htmlFor={`setup-link-${key}`}
                            className="block text-[10px] font-medium uppercase tracking-[0.16em] text-white/55"
                          >
                            {label}
                          </label>
                          <input
                            id={`setup-link-${key}`}
                            type="text"
                            inputMode="url"
                            autoComplete="off"
                            value={draftLinks[key]}
                            onChange={(e) =>
                              setDraftLinks((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            placeholder={placeholder}
                            className={`${GLASS_FIELD_BASE} min-h-[44px] text-[14px]`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="order-2 rounded-[14px] border border-white/15 px-4 py-3 text-[13px] font-medium text-white/80 sm:order-1"
                    >
                      Назад
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmLinks}
                      className="order-1 rounded-[14px] bg-gradient-to-tr from-violet-600 to-indigo-600 px-5 py-3 text-[14px] font-semibold text-white shadow-md sm:order-2"
                    >
                      Подтвердить ссылки
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
