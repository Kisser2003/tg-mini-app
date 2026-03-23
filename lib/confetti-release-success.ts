import confetti from "canvas-confetti";

/**
 * Праздничный салют после подтверждения отправки релиза (статус `pending` / `processing` в БД).
 * Только в браузере.
 */
export function celebrateReleaseSubmission(): void {
  if (typeof window === "undefined") return;
  const colors = ["#a855f7", "#6366f1", "#e879f9", "#f0abfc", "#ffffff"];
  const base = { origin: { y: 0.72 }, colors };
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
      colors
    });
    void confetti({
      particleCount: 40,
      angle: 60,
      spread: 55,
      origin: { x: 0.85, y: 0.75 },
      colors
    });
  }, 320);
}
