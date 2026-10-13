import { getTelegramWebApp } from "@/lib/telegram";

function hapticFeedback() {
  return getTelegramWebApp()?.HapticFeedback;
}

/**
 * Единая точка тактильных паттернов для TMA (в браузере — no-op).
 *
 * Словарь:
 * - `selection` — выбор из вариантов: таб, чип фильтра, сегмент, переключатель, раскрытие блока;
 * - `impactLight` — обычная навигация: открыть экран, «Назад», «Дальше»;
 * - `impactMedium` — весомое действие: отправить релиз, подтвердить решение;
 * - `notification*` — итог операции (успех / предупреждение / ошибка).
 */
export const hapticMap = {
  selection: (): void => {
    try {
      hapticFeedback()?.selectionChanged?.();
    } catch {
      /* ignore */
    }
  },
  impactLight: (): void => {
    try {
      hapticFeedback()?.impactOccurred?.("light");
    } catch {
      /* ignore */
    }
  },
  impactMedium: (): void => {
    try {
      hapticFeedback()?.impactOccurred?.("medium");
    } catch {
      /* ignore */
    }
  },
  impactHeavy: (): void => {
    try {
      hapticFeedback()?.impactOccurred?.("heavy");
    } catch {
      /* ignore */
    }
  },
  notificationSuccess: (): void => {
    try {
      hapticFeedback()?.notificationOccurred?.("success");
    } catch {
      /* ignore */
    }
  },
  notificationError: (): void => {
    try {
      hapticFeedback()?.notificationOccurred?.("error");
    } catch {
      /* ignore */
    }
  },
  notificationWarning: (): void => {
    try {
      hapticFeedback()?.notificationOccurred?.("warning");
    } catch {
      /* ignore */
    }
  }
};
