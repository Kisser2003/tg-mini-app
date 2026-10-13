import confetti from "canvas-confetti";

/**
 * Праздничный салют после подтверждения отправки релиза (статус `pending` / `processing` в БД).
 * Только в браузере.
 */
export function celebrateReleaseSubmission(): void {
  if (typeof window === "undefined") return;
  /** Палитра OMF: ультрамарин, жёлтая и зелёная «наклейки», светлый ink (не старый фиолетовый неон). */
  const colors = ["#2f3fe0", "#8c9bff", "#f5d90a", "#1f9d63", "#eceef0"];
  /** «Уменьшить движение» в ОС — без салюта. */
  const base = { origin: { y: 0.72 }, colors, disableForReducedMotion: true };
  void confetti({ ...base, particleCount: 90, spread: 58, startVelocity: 32 });
  window.setTimeout(() => {
    void confetti({
      ...base,
      particleCount: 55,
      spread: 100,
      scalar: 0.9,
      ticks: 220
    });
  }, 180);
  window.setTimeout(() => {
    void confetti({
      particleCount: 40,
      angle: 120,
      spread: 55,
      origin: { x: 0.15, y: 0.75 },
      colors,
      disableForReducedMotion: true
    });
    void confetti({
      particleCount: 40,
      angle: 60,
      spread: 55,
      origin: { x: 0.85, y: 0.75 },
      colors,
      disableForReducedMotion: true
    });
  }, 320);
}
